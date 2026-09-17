// Pure builders for practice question selection. No database access here, so they can
// be unit-tested; src/server/queries/questions.ts runs them. pickQuestionIds and
// countsBySource both build their filter here, so the counts on the setup screen
// always describe exactly the set that gets picked.

import type { Prisma } from "@/generated/prisma/client";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import { MASTERED_BOX } from "@/lib/quiz/leitner";

/** Practice sizes offered on the setup screen. Lives here, not with the Zod schemas, so
 * the client form can import it without pulling Zod into the bundle. */
export const PRACTICE_COUNTS = [10, 20, 50] as const;
export type PracticeCount = (typeof PRACTICE_COUNTS)[number];

/** A retry ("Алдсануудаа дахин давтах") takes at most this many questions. */
export const MAX_CUSTOM_QUESTIONS = 100;

/** The sources shown with a count on the setup screen. CUSTOM is only ever a retry. */
export const COUNTED_SOURCES = [
  AttemptSource.NEW,
  AttemptSource.WRONG,
  AttemptSource.DUE,
  AttemptSource.RANDOM,
  AttemptSource.BOOKMARKED,
] as const;

export type CountedSource = (typeof COUNTED_SOURCES)[number];

type FilterBase = {
  userId: string;
  subjectId?: string | null;
  /** Passed in so a count and a pick made together agree on what is due. */
  now: Date;
};

export type SourceFilter = FilterBase &
  (
    | { source: CountedSource }
    // Question ids are resolved on the server from an attempt the user owns; they
    // never come from the client.
    | { source: typeof AttemptSource.CUSTOM; questionIds: readonly string[] }
  );

function sourceClause(filter: SourceFilter): Prisma.QuestionWhereInput {
  const { userId, now } = filter;
  switch (filter.source) {
    case AttemptSource.NEW:
      // No progress row, rather than "never in an attempt": a question left unanswered
      // in an abandoned attempt is still new.
      return { progress: { none: { userId } } };
    case AttemptSource.WRONG:
      return {
        progress: { some: { userId, wrongCount: { gt: 0 }, box: { lt: MASTERED_BOX } } },
      };
    case AttemptSource.DUE:
      return { progress: { some: { userId, nextReviewAt: { lte: now } } } };
    case AttemptSource.RANDOM:
      return {};
    case AttemptSource.BOOKMARKED:
      return { bookmarks: { some: { userId } } };
    case AttemptSource.CUSTOM:
      return { id: { in: filter.questionIds.slice(0, MAX_CUSTOM_QUESTIONS) } };
  }
}

/** Every source is limited to active questions and, when given, to one subject. */
export function questionWhereForSource(filter: SourceFilter): Prisma.QuestionWhereInput {
  return {
    AND: [
      { isActive: true, ...(filter.subjectId ? { subjectId: filter.subjectId } : {}) },
      sourceClause(filter),
    ],
  };
}

/**
 * Sources where urgency matters pick from the user's progress rows in this order, take
 * `count`, and only then shuffle. Null means "shuffle the whole matching set".
 */
export function progressOrderForSource(
  source: AttemptSource,
): Prisma.QuestionProgressOrderByWithRelationInput[] | null {
  switch (source) {
    case AttemptSource.DUE:
      // Most overdue first. The DUE filter already excludes a null nextReviewAt.
      return [{ nextReviewAt: "asc" }];
    case AttemptSource.WRONG:
      return [{ box: "asc" }, { nextReviewAt: { sort: "asc", nulls: "last" } }];
    default:
      return null;
  }
}

/**
 * An exam's results stay hidden until it is submitted, so retrying from an exam in
 * progress would leak which answers are wrong. A practice item is revealed as soon as
 * it is answered, so a practice attempt can be retried at any time.
 */
export function canRetryFrom(mode: AttemptMode, status: AttemptStatus): boolean {
  return mode === AttemptMode.PRACTICE || status !== AttemptStatus.IN_PROGRESS;
}

/** Items of an attempt that a retry should bring back. */
export function incorrectItemsWhere(mode: AttemptMode): Prisma.AttemptItemWhereInput {
  if (mode === AttemptMode.PRACTICE) return { isCorrect: false };
  // Exam: anything not graded correct counts, including unanswered items. A plain
  // `isCorrect: { not: true }` would miss NULLs (SQL `<>` never matches NULL).
  return { OR: [{ selectedOptionId: null }, { isCorrect: false }, { isCorrect: null }] };
}
