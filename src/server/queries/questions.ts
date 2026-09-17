import "server-only";
import { AttemptSource } from "@/generated/prisma/enums";
import { now as clockNow } from "@/lib/clock";
import { db } from "@/lib/db";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { buildQuestionOrder } from "@/lib/quiz/shuffle";
import {
  canRetryFrom,
  COUNTED_SOURCES,
  incorrectItemsWhere,
  MAX_CUSTOM_QUESTIONS,
  progressOrderForSource,
  questionWhereForSource,
  type CountedSource,
  type SourceFilter,
} from "./question-sources";

/**
 * Question ids of the user's attempt that a retry should bring back, in the order they
 * were asked. Empty when the attempt is not the user's or cannot be retried yet.
 */
export async function resolveRetryQuestionIds(
  userId: string,
  attemptId: string,
): Promise<string[]> {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
    select: { mode: true, status: true },
  });
  if (!attempt || !canRetryFrom(attempt.mode, attempt.status)) return [];

  const items = await db.attemptItem.findMany({
    where: { attemptId, ...incorrectItemsWhere(attempt.mode) },
    orderBy: { position: "asc" },
    take: MAX_CUSTOM_QUESTIONS,
    select: { questionId: true },
  });
  return items.map((item) => item.questionId);
}

export type PickQuestionIdsInput = {
  userId: string;
  source: AttemptSource;
  subjectId?: string | null;
  count: number;
  /** CUSTOM only: the attempt whose incorrect items are retried. */
  fromAttemptId?: string | null;
};

/** At most `count` question ids in random order; fewer when not enough match. */
export async function pickQuestionIds(input: PickQuestionIdsInput): Promise<string[]> {
  const { userId, source, subjectId } = input;
  const count = Math.floor(input.count);
  if (!(count > 0)) return [];

  // The app clock, so a count and a pick agree with the timestamps written by an
  // attempt (and so the database suite can move "due" around).
  const now = clockNow();
  const filter: SourceFilter =
    source === AttemptSource.CUSTOM
      ? {
          userId,
          subjectId,
          now,
          source,
          questionIds: input.fromAttemptId
            ? await resolveRetryQuestionIds(userId, input.fromAttemptId)
            : [],
        }
      : { userId, subjectId, now, source };
  const where = questionWhereForSource(filter);

  const progressOrder = progressOrderForSource(source);
  if (progressOrder) {
    // Urgent first: take the `count` most urgent from the user's own progress rows,
    // then shuffle only those. (userId, questionId) is unique, so the question filter
    // selects exactly the same set that countsBySource counts.
    const rows = await db.questionProgress.findMany({
      where: { userId, question: where },
      orderBy: progressOrder,
      take: count,
      select: { questionId: true },
    });
    return buildQuestionOrder(
      rows.map((row) => row.questionId),
      cryptoRandomInt,
    );
  }

  // NEW, RANDOM, BOOKMARKED and CUSTOM: shuffle the whole matching set. For a retry
  // this also reshuffles the questions, which resolveRetryQuestionIds returns in the
  // order they were first asked.
  const rows = await db.question.findMany({ where, select: { id: true } });
  return buildQuestionOrder(
    rows.map((row) => row.id),
    cryptoRandomInt,
  ).slice(0, count);
}

export type SourceCounts = Record<CountedSource, number>;

/** How many questions each setup-screen source would offer right now. */
export async function countsBySource(
  userId: string,
  subjectId?: string | null,
): Promise<SourceCounts> {
  const now = clockNow();
  const counts = await Promise.all(
    COUNTED_SOURCES.map((source) =>
      db.question.count({
        where: questionWhereForSource({ userId, subjectId, now, source }),
      }),
    ),
  );
  return Object.fromEntries(
    COUNTED_SOURCES.map((source, index) => [source, counts[index]]),
  ) as SourceCounts;
}

/** Subjects that currently have something to practise, in their configured order. */
export async function listSubjects() {
  return db.subject.findMany({
    where: { questions: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
