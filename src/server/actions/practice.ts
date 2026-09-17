"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { isCorrectAnswer, scoreItems } from "@/lib/quiz/grading";
import { buildAttemptItems } from "@/server/mutations/attempt-items";
import { applyProgress } from "@/server/mutations/progress";
import { MAX_CUSTOM_QUESTIONS } from "@/server/queries/question-sources";
import { pickQuestionIds } from "@/server/queries/questions";
import {
  attemptIdSchema,
  createPracticeAttemptSchema,
  firstErrorMessage,
  PRACTICE_MESSAGES,
  reportQuestionSchema,
  REPORTS_PER_DAY,
  setBookmarkSchema,
  submitPracticeAnswerSchema,
  type CreatePracticeAttemptInput,
  type ReportQuestionInput,
  type SetBookmarkInput,
  type SubmitPracticeAnswerInput,
} from "./practice.schemas";

export type ActionError = { error: string };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a practice attempt and redirects to it. Returns an error instead of creating
 * an empty attempt when nothing matches.
 */
export async function createPracticeAttempt(
  input: CreatePracticeAttemptInput,
): Promise<ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = createPracticeAttemptSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const data = parsed.data;

  // Ownership of a retry's source attempt is checked inside pickQuestionIds.
  const questionIds = await pickQuestionIds(
    data.source === AttemptSource.CUSTOM
      ? {
          userId: user.id,
          source: data.source,
          fromAttemptId: data.fromAttemptId,
          count: MAX_CUSTOM_QUESTIONS,
        }
      : { userId: user.id, source: data.source, subjectId: data.subjectId, count: data.count },
  );
  if (questionIds.length === 0) return { error: PRACTICE_MESSAGES.noQuestions };

  // Keeps the picked (shuffled) question order; drops anything that vanished meanwhile.
  const items = await buildAttemptItems(db, user.id, questionIds);
  if (items.length === 0) return { error: PRACTICE_MESSAGES.noQuestions };

  const attempt = await db.$transaction(async (tx) => {
    const created = await tx.attempt.create({
      data: {
        userId: user.id,
        mode: AttemptMode.PRACTICE,
        source: data.source,
        subjectId: data.source === AttemptSource.CUSTOM ? null : (data.subjectId ?? null),
        totalCount: items.length,
        startedAt: now(),
      },
      select: { id: true },
    });
    await tx.attemptItem.createMany({
      data: items.map((item, position) => ({ ...item, attemptId: created.id, position })),
    });
    return created;
  });

  redirect(`/practice/${attempt.id}`);
}

export type PracticeAnswerResult = {
  isCorrect: boolean;
  /** The stored choice; after a double click it is the first one. */
  selectedOptionId: string;
  correctOptionId: string;
  explanation: string | null;
};

/**
 * Answers one practice item, once. The conditional update (selectedOptionId still
 * null) is the guard: a second request for the same item, e.g. a double click, updates
 * nothing, so QuestionProgress is not touched twice; it just returns the stored result.
 */
export async function submitPracticeAnswer(
  input: SubmitPracticeAnswerInput,
): Promise<PracticeAnswerResult | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = submitPracticeAnswerSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const { attemptItemId, optionId } = parsed.data;

  const ownItem = { id: attemptItemId, attempt: { userId: user.id, mode: AttemptMode.PRACTICE } };
  const item = await db.attemptItem.findFirst({
    where: ownItem,
    select: {
      attemptId: true,
      questionId: true,
      optionOrder: true,
      selectedOptionId: true,
      isCorrect: true,
      attempt: { select: { status: true } },
      question: {
        select: {
          explanation: true,
          options: { select: { id: true, isCorrect: true } },
        },
      },
    },
  });
  if (!item) return { error: PRACTICE_MESSAGES.notFound };

  const correct = item.question.options.find((option) => option.isCorrect);
  if (!correct) return { error: PRACTICE_MESSAGES.noCorrectOption };
  const resultFor = (selectedOptionId: string, isCorrect: boolean): PracticeAnswerResult => ({
    isCorrect,
    selectedOptionId,
    correctOptionId: correct.id,
    explanation: item.question.explanation,
  });

  // Already answered: the result is already revealed, so return it unchanged.
  if (item.selectedOptionId !== null) {
    return resultFor(item.selectedOptionId, item.isCorrect === true);
  }
  if (item.attempt.status !== AttemptStatus.IN_PROGRESS) {
    return { error: PRACTICE_MESSAGES.attemptClosed };
  }
  if (!item.optionOrder.includes(optionId)) return { error: PRACTICE_MESSAGES.invalid };

  const isCorrect = isCorrectAnswer(optionId, item.question.options);
  const saved = await db.$transaction(async (tx) => {
    const answeredAt = now();
    const { count } = await tx.attemptItem.updateMany({
      where: {
        ...ownItem,
        selectedOptionId: null,
        attempt: { ...ownItem.attempt, status: AttemptStatus.IN_PROGRESS },
      },
      data: { selectedOptionId: optionId, isCorrect, answeredAt },
    });
    if (count === 0) return false;
    await applyProgress(tx, user.id, [{ questionId: item.questionId, isCorrect }], answeredAt);
    return true;
  });

  if (!saved) {
    // Lost a race with another request for this item: report what was stored.
    const stored = await db.attemptItem.findFirst({
      where: ownItem,
      select: { selectedOptionId: true, isCorrect: true },
    });
    if (stored?.selectedOptionId) return resultFor(stored.selectedOptionId, stored.isCorrect === true);
    return { error: PRACTICE_MESSAGES.attemptClosed };
  }

  revalidatePath(`/practice/${item.attemptId}`);
  return resultFor(optionId, isCorrect);
}

/** Closes a practice attempt and redirects to its summary. Closing twice is harmless. */
export async function finishPracticeAttempt(attemptId: string): Promise<ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = attemptIdSchema.safeParse(attemptId);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const id = parsed.data;

  const where = { id, userId: user.id, mode: AttemptMode.PRACTICE };
  const attempt = await db.attempt.findFirst({ where, select: { status: true } });
  if (!attempt) return { error: PRACTICE_MESSAGES.notFound };

  if (attempt.status === AttemptStatus.IN_PROGRESS) {
    await db.$transaction(async (tx) => {
      // Close first, so no answer can be saved after the score is counted.
      const { count } = await tx.attempt.updateMany({
        where: { ...where, status: AttemptStatus.IN_PROGRESS },
        data: { status: AttemptStatus.SUBMITTED, submittedAt: now() },
      });
      if (count === 0) return;
      const items = await tx.attemptItem.findMany({
        where: { attemptId: id },
        select: { selectedOptionId: true, isCorrect: true },
      });
      await tx.attempt.update({
        where: { id },
        data: { correctCount: scoreItems(items).correct },
      });
    });
  }

  redirect(`/practice/${id}/summary`);
}

/**
 * Sets a question's bookmark to exactly `bookmarked`. Idempotent on purpose: the
 * caller says what it wants, not "flip it", so a double click on "remove" cannot add
 * the bookmark back. Returns the state that is now stored.
 */
export async function setBookmark(
  input: SetBookmarkInput,
): Promise<{ bookmarked: boolean } | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = setBookmarkSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const { questionId, bookmarked } = parsed.data;

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) return { error: PRACTICE_MESSAGES.notFound };

  const key = { userId: user.id, questionId: question.id };
  if (bookmarked) {
    // INSERT ... ON CONFLICT DO NOTHING: adding twice is not an error.
    await db.bookmark.createMany({ data: [key], skipDuplicates: true });
  } else {
    // deleteMany, so removing an already removed bookmark changes nothing.
    await db.bookmark.deleteMany({ where: key });
  }
  return { bookmarked };
}

export async function reportQuestion(
  input: ReportQuestionInput,
): Promise<{ ok: true } | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = reportQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const { questionId, message } = parsed.data;

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { id: true },
  });
  if (!question) return { error: PRACTICE_MESSAGES.notFound };

  // A rolling window, so the limit does not depend on the server's time zone.
  const recent = await db.questionReport.count({
    where: { userId: user.id, createdAt: { gte: new Date(now().getTime() - DAY_MS) } },
  });
  if (recent >= REPORTS_PER_DAY) return { error: PRACTICE_MESSAGES.reportLimit };

  await db.questionReport.create({
    data: { questionId: question.id, userId: user.id, message },
  });
  return { ok: true };
}
