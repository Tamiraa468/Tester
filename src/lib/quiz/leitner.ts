// Leitner box scheduling. Field names match QuestionProgress in prisma/schema.prisma,
// so a server action can pass the result straight through.

export const MAX_BOX = 5;

/** From this box on, a question counts as mastered. */
export const MASTERED_BOX = 3;

/** Minutes until the next review, by box: 10 minutes, then 1, 3, 7, 14 and 30 days. */
export const REVIEW_INTERVALS: Record<number, number> = {
  0: 10,
  1: 24 * 60,
  2: 3 * 24 * 60,
  3: 7 * 24 * 60,
  4: 14 * 24 * 60,
  5: 30 * 24 * 60,
};

const MINUTE_MS = 60_000;

export function isMastered(box: number): boolean {
  return box >= MASTERED_BOX;
}

export type ProgressCounts = {
  box: number;
  correctCount: number;
  wrongCount: number;
};

export type NextProgress = ProgressCounts & {
  lastAnsweredAt: Date;
  nextReviewAt: Date;
};

/**
 * A correct answer moves the question up one box (capped at MAX_BOX); a wrong answer
 * sends it back to box 0 but keeps both counts. Returns fresh Dates and never mutates `now`.
 */
export function nextProgress(
  current: ProgressCounts | null,
  wasCorrect: boolean,
  now: Date,
): NextProgress {
  const previous = current ?? { box: 0, correctCount: 0, wrongCount: 0 };
  const box = wasCorrect ? Math.min(previous.box + 1, MAX_BOX) : 0;
  return {
    box,
    correctCount: previous.correctCount + (wasCorrect ? 1 : 0),
    wrongCount: previous.wrongCount + (wasCorrect ? 0 : 1),
    lastAnsweredAt: new Date(now.getTime()),
    nextReviewAt: new Date(now.getTime() + REVIEW_INTERVALS[box] * MINUTE_MS),
  };
}
