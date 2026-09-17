// Internal write helpers for exams: no auth checks. Callers (server actions) have
// already authenticated and pass the user id; every query is still scoped by it.
// Never export these from a "use server" file.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { examDeadline, isExpired } from "@/lib/quiz/exam-time";
import { isCorrectAnswer, scoreItems } from "@/lib/quiz/grading";
import { applyProgress } from "./progress";

type Tx = Prisma.TransactionClient;

export type LockedExam = {
  id: string;
  status: AttemptStatus;
  startedAt: Date;
  timeLimitSec: number | null;
  deadline: Date | null;
};

/**
 * Locks the user's exam row for the rest of the transaction and reads it. Saves take a
 * shared lock and finishing takes an exclusive one, so an answer can never be saved
 * after the exam has been graded. Null when it is not this user's exam.
 */
export async function lockExam(
  tx: Tx,
  attemptId: string,
  userId: string,
  mode: "share" | "update",
): Promise<LockedExam | null> {
  // Only the lock is raw SQL; the row itself is read through Prisma (typed dates).
  const locked =
    mode === "update"
      ? await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Attempt" WHERE "id" = ${attemptId} AND "userId" = ${userId} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Attempt" WHERE "id" = ${attemptId} AND "userId" = ${userId} FOR SHARE`;
  if (locked.length === 0) return null;

  const attempt = await tx.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, mode: true, status: true, startedAt: true, timeLimitSec: true },
  });
  if (!attempt || attempt.mode !== AttemptMode.EXAM) return null;
  return {
    id: attempt.id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    timeLimitSec: attempt.timeLimitSec,
    deadline: examDeadline(attempt.startedAt, attempt.timeLimitSec),
  };
}

/**
 * Grades every item (unanswered = incorrect), updates QuestionProgress for answered
 * items only, and closes the attempt. The caller holds the exclusive lock and has
 * checked that the exam is still in progress.
 */
export async function finalizeExam(
  tx: Tx,
  exam: LockedExam,
  userId: string,
  status: typeof AttemptStatus.SUBMITTED | typeof AttemptStatus.EXPIRED,
  finishedAt: Date,
): Promise<void> {
  const items = await tx.attemptItem.findMany({
    where: { attemptId: exam.id },
    select: {
      id: true,
      questionId: true,
      selectedOptionId: true,
      question: { select: { options: { select: { id: true, isCorrect: true } } } },
    },
  });
  const graded = items.map((item) => ({
    id: item.id,
    questionId: item.questionId,
    selectedOptionId: item.selectedOptionId,
    isCorrect: isCorrectAnswer(item.selectedOptionId, item.question.options),
  }));

  if (graded.length > 0) {
    await tx.$executeRaw`
      UPDATE "AttemptItem" AS i
      SET "isCorrect" = v."isCorrect"
      FROM unnest(
        ${graded.map((item) => item.id)}::text[],
        ${graded.map((item) => item.isCorrect)}::boolean[]
      ) AS v("id", "isCorrect")
      WHERE i."id" = v."id" AND i."attemptId" = ${exam.id}`;
  }

  await applyProgress(
    tx,
    userId,
    graded
      .filter((item) => item.selectedOptionId !== null)
      .map((item) => ({ questionId: item.questionId, isCorrect: item.isCorrect })),
    finishedAt,
  );

  await tx.attempt.update({
    where: { id: exam.id },
    data: { status, submittedAt: finishedAt, correctCount: scoreItems(graded).correct },
  });
}

/**
 * Finalizes an exam as EXPIRED if its grace period is over, recording the deadline as
 * its finish time. Returns the attempt's status afterwards, or null when it is not
 * this user's exam.
 */
export async function expireExamIfDue(
  attemptId: string,
  userId: string,
): Promise<AttemptStatus | null> {
  return db.$transaction(async (tx) => {
    const exam = await lockExam(tx, attemptId, userId, "update");
    if (!exam) return null;
    if (exam.status === AttemptStatus.IN_PROGRESS && exam.deadline && isExpired(now(), exam.deadline)) {
      await finalizeExam(tx, exam, userId, AttemptStatus.EXPIRED, exam.deadline);
      return AttemptStatus.EXPIRED;
    }
    return exam.status;
  });
}

/** Finalizes the user's open exam if it has expired. Pages that list attempts call this first. */
export async function expireOpenExamIfDue(userId: string): Promise<void> {
  const open = await db.attempt.findFirst({
    where: { userId, mode: AttemptMode.EXAM, status: AttemptStatus.IN_PROGRESS },
    select: { id: true, startedAt: true, timeLimitSec: true },
  });
  if (!open) return;
  // Cheap check first, so the common case takes no lock.
  if (!isExpired(now(), examDeadline(open.startedAt, open.timeLimitSec))) return;
  await expireExamIfDue(open.id, userId);
}
