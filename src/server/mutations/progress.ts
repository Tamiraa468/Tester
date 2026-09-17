// Internal write helper: no auth checks. Only server actions call it, inside their
// own transaction. Never export it from a "use server" file.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextProgress, type ProgressCounts } from "@/lib/quiz/leitner";

export type ProgressAnswer = { questionId: string; isCorrect: boolean };

/**
 * The only place QuestionProgress is written. Safe under concurrency: two attempts of
 * the same user answering the same question at the same moment are both counted, and
 * the first save of a new question never fails on the unique key.
 *
 * 1. Missing rows are created with INSERT ... ON CONFLICT DO NOTHING (createMany with
 *    skipDuplicates), in questionId order.
 * 2. The rows are locked with SELECT ... FOR UPDATE, in questionId order. The fixed
 *    order means two transactions never wait on each other in a cycle (no deadlock).
 * 3. nextProgress() is applied in JS, and every row is written by one UPDATE.
 */
export async function applyProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  answers: readonly ProgressAnswer[],
  now: Date,
): Promise<void> {
  if (answers.length === 0) return;
  const questionIds = [...new Set(answers.map((answer) => answer.questionId))].sort();

  await tx.questionProgress.createMany({
    data: questionIds.map((questionId) => ({ userId, questionId })),
    skipDuplicates: true,
  });

  const rows = await tx.$queryRaw<(ProgressCounts & { questionId: string })[]>`
    SELECT "questionId", "box", "correctCount", "wrongCount"
    FROM "QuestionProgress"
    WHERE "userId" = ${userId} AND "questionId" = ANY(${questionIds}::text[])
    ORDER BY "questionId"
    FOR UPDATE`;
  if (rows.length !== questionIds.length) {
    throw new Error("QuestionProgress rows missing after insert.");
  }

  // Fold in answer order, so one question answered twice in a batch counts twice.
  const next = new Map<string, ProgressCounts & { lastAnsweredAt: Date; nextReviewAt: Date }>();
  const current = new Map(rows.map((row) => [row.questionId, row]));
  for (const answer of answers) {
    const previous = next.get(answer.questionId) ?? current.get(answer.questionId) ?? null;
    next.set(answer.questionId, nextProgress(previous, answer.isCorrect, now));
  }

  const ids = [...next.keys()];
  const values = ids.map((id) => next.get(id)!);
  // Prisma stores DateTime as UTC in timestamp(3) columns; an ISO string cast to
  // timestamp keeps that wall time.
  await tx.$executeRaw`
    UPDATE "QuestionProgress" AS p
    SET "box" = v."box",
        "correctCount" = v."correctCount",
        "wrongCount" = v."wrongCount",
        "lastAnsweredAt" = v."lastAnsweredAt",
        "nextReviewAt" = v."nextReviewAt"
    FROM unnest(
      ${ids}::text[],
      ${values.map((v) => v.box)}::int[],
      ${values.map((v) => v.correctCount)}::int[],
      ${values.map((v) => v.wrongCount)}::int[],
      ${values.map((v) => v.lastAnsweredAt.toISOString())}::timestamp(3)[],
      ${values.map((v) => v.nextReviewAt.toISOString())}::timestamp(3)[]
    ) AS v("questionId", "box", "correctCount", "wrongCount", "lastAnsweredAt", "nextReviewAt")
    WHERE p."userId" = ${userId} AND p."questionId" = v."questionId"`;
}

/**
 * Puts every user's progress for ONE question back to box 0 and makes it due now.
 *
 * Used when an admin changes which option is correct: what those users learnt was
 * graded against the old key, so their schedule is no longer meaningful. The answer
 * counts and lastAnsweredAt are left alone — they are history — and graded
 * AttemptItems are never touched, so old attempts keep their results.
 *
 * Lives here because this module owns every write to QuestionProgress; applyProgress()
 * cannot express a reset, since it only ever applies a Leitner transition.
 */
export async function resetProgressForQuestion(
  tx: Prisma.TransactionClient,
  questionId: string,
  at: Date,
): Promise<number> {
  const { count } = await tx.questionProgress.updateMany({
    where: { questionId },
    data: { box: 0, nextReviewAt: at },
  });
  return count;
}
