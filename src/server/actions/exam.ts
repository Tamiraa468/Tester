"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { isPresetOffered, planPreset } from "@/lib/quiz/exam-preset";
import { acceptsAnswers, examDeadline, isExpired } from "@/lib/quiz/exam-time";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { buildQuestionOrder, shuffled } from "@/lib/quiz/shuffle";
import { buildAttemptItems } from "@/server/mutations/attempt-items";
import {
  expireExamIfDue,
  expireOpenExamIfDue,
  finalizeExam,
  lockExam,
} from "@/server/mutations/exam";
import { getBankCounts } from "@/server/queries/exams";
import {
  attemptItemIdSchema,
  EXAM_MESSAGES,
  examAttemptIdSchema,
  presetIdSchema,
  saveExamAnswerSchema,
  type SaveExamAnswerInput,
} from "./exam.schemas";

/** `closed`: the exam is over (submitted, expired or out of time); reload the page. */
export type ActionError = { error: string; closed?: true };

// Picking and creating up to 100 items can take longer than Prisma's 5 s default.
const LONG_TRANSACTION = { timeout: 20_000, maxWait: 10_000 } as const;

/**
 * Starts an exam from a preset and redirects to it. The ONLY code path that creates
 * EXAM attempts. A transaction-scoped advisory lock keyed on the user serializes
 * concurrent starts, so a user never has two exams in progress: a second start
 * redirects to the first.
 */
export async function startExam(presetId: string): Promise<ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = presetIdSchema.safeParse(presetId);
  if (!parsed.success) return { error: EXAM_MESSAGES.invalid };
  if (!isPresetOffered(parsed.data, process.env.NODE_ENV)) {
    return { error: EXAM_MESSAGES.presetNotFound };
  }

  type Outcome = { attemptId: string } | { error: string };
  const outcome = await db.$transaction(async (tx): Promise<Outcome> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('exam:' || ${user.id}))`;
    const startedAt = now();

    const open = await tx.attempt.findFirst({
      where: { userId: user.id, mode: AttemptMode.EXAM, status: AttemptStatus.IN_PROGRESS },
      select: { id: true },
    });
    if (open) {
      const exam = await lockExam(tx, open.id, user.id, "update");
      if (!exam) return { error: EXAM_MESSAGES.notFound };
      // Still running: continue it instead of starting a second one.
      if (!exam.deadline || !isExpired(startedAt, exam.deadline)) return { attemptId: exam.id };
      await finalizeExam(tx, exam, user.id, AttemptStatus.EXPIRED, exam.deadline);
    }

    const preset = await tx.examPreset.findFirst({
      where: { id: parsed.data, isActive: true },
      select: { id: true, questionCount: true, timeLimitMin: true, distribution: true },
    });
    if (!preset) return { error: EXAM_MESSAGES.presetNotFound };

    const plan = planPreset(preset, await getBankCounts());
    if (!plan.ok) return { error: plan.reason };

    let picked: string[];
    if (plan.perSubject) {
      const groups = await Promise.all(
        plan.perSubject.map(async ({ subjectId, count }) => {
          const rows = await tx.question.findMany({
            where: { isActive: true, subjectId },
            select: { id: true },
          });
          return shuffled(rows.map((row) => row.id), cryptoRandomInt).slice(0, count);
        }),
      );
      picked = groups.flat();
    } else {
      const rows = await tx.question.findMany({ where: { isActive: true }, select: { id: true } });
      picked = shuffled(rows.map((row) => row.id), cryptoRandomInt).slice(0, plan.total);
    }
    // Subjects are interleaved rather than asked in blocks.
    const items = await buildAttemptItems(tx, user.id, buildQuestionOrder(picked, cryptoRandomInt));
    if (items.length !== plan.total) return { error: EXAM_MESSAGES.bankChanged };

    const created = await tx.attempt.create({
      data: {
        userId: user.id,
        mode: AttemptMode.EXAM,
        presetId: preset.id,
        timeLimitSec: preset.timeLimitMin * 60,
        totalCount: items.length,
        startedAt,
      },
      select: { id: true },
    });
    await tx.attemptItem.createMany({
      data: items.map((item, position) => ({ ...item, attemptId: created.id, position })),
    });
    return { attemptId: created.id };
  }, LONG_TRANSACTION);

  if ("error" in outcome) return { error: outcome.error };
  redirect(`/exam/${outcome.attemptId}`);
}

export type SaveExamAnswerResult = {
  /** ISO time the server stored the answer; also used to re-sync the countdown. */
  serverNow: string;
};

/**
 * Autosaves an answer (or clears it with null). Answers may change until the exam is
 * finished; after the deadline plus the grace period they are rejected. Never returns
 * or computes correctness.
 */
export async function saveExamAnswer(
  input: SaveExamAnswerInput,
): Promise<SaveExamAnswerResult | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = saveExamAnswerSchema.safeParse(input);
  if (!parsed.success) return { error: EXAM_MESSAGES.invalid };
  const { attemptItemId, optionId } = parsed.data;

  return db.$transaction(async (tx) => {
    const item = await tx.attemptItem.findFirst({
      where: { id: attemptItemId, attempt: { userId: user.id, mode: AttemptMode.EXAM } },
      select: { attemptId: true, optionOrder: true },
    });
    if (!item) return { error: EXAM_MESSAGES.notFound };

    const exam = await lockExam(tx, item.attemptId, user.id, "share");
    if (!exam) return { error: EXAM_MESSAGES.notFound };
    if (exam.status !== AttemptStatus.IN_PROGRESS) {
      return { error: EXAM_MESSAGES.closed, closed: true };
    }
    const current = now();
    if (!acceptsAnswers(current, exam.deadline)) {
      return { error: EXAM_MESSAGES.timeUp, closed: true };
    }
    if (optionId !== null && !item.optionOrder.includes(optionId)) {
      return { error: EXAM_MESSAGES.invalid };
    }

    await tx.attemptItem.update({
      where: { id: attemptItemId },
      data: { selectedOptionId: optionId, answeredAt: optionId === null ? null : current },
    });
    return { serverNow: current.toISOString() };
  });
}

/** Toggles "Эргэж харах" (AttemptItem.flagged) while the exam is running. */
export async function toggleReviewMark(
  attemptItemId: string,
): Promise<{ flagged: boolean } | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = attemptItemIdSchema.safeParse(attemptItemId);
  if (!parsed.success) return { error: EXAM_MESSAGES.invalid };

  return db.$transaction(async (tx) => {
    const item = await tx.attemptItem.findFirst({
      where: { id: parsed.data, attempt: { userId: user.id, mode: AttemptMode.EXAM } },
      select: { attemptId: true },
    });
    if (!item) return { error: EXAM_MESSAGES.notFound };

    const exam = await lockExam(tx, item.attemptId, user.id, "share");
    if (!exam) return { error: EXAM_MESSAGES.notFound };
    if (exam.status !== AttemptStatus.IN_PROGRESS) {
      return { error: EXAM_MESSAGES.closed, closed: true };
    }
    if (!acceptsAnswers(now(), exam.deadline)) {
      return { error: EXAM_MESSAGES.timeUp, closed: true };
    }

    // Flipped in SQL, so two quick toggles can't both read the same old value.
    const [row] = await tx.$queryRaw<{ flagged: boolean }[]>`
      UPDATE "AttemptItem" SET "flagged" = NOT "flagged"
      WHERE "id" = ${parsed.data} RETURNING "flagged"`;
    return { flagged: row.flagged };
  });
}

/**
 * Grades and closes the exam, then redirects to the result. A submit after the grace
 * period finalizes it as EXPIRED at its deadline. Submitting a finished exam changes
 * nothing and just redirects.
 */
export async function submitExam(attemptId: string): Promise<ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = examAttemptIdSchema.safeParse(attemptId);
  if (!parsed.success) return { error: EXAM_MESSAGES.invalid };

  const found = await db.$transaction(async (tx) => {
    const exam = await lockExam(tx, parsed.data, user.id, "update");
    if (!exam) return false;
    if (exam.status === AttemptStatus.IN_PROGRESS) {
      const current = now();
      if (acceptsAnswers(current, exam.deadline)) {
        await finalizeExam(tx, exam, user.id, AttemptStatus.SUBMITTED, current);
      } else {
        await finalizeExam(tx, exam, user.id, AttemptStatus.EXPIRED, exam.deadline!);
      }
    }
    return true;
  }, LONG_TRANSACTION);

  if (!found) return { error: EXAM_MESSAGES.notFound };
  redirect(`/exam/${parsed.data}/result`);
}

/**
 * Finalizes this exam as EXPIRED if its time (plus grace) is over. The exam pages call
 * it before deciding what to show. Returns the status afterwards, or null when the
 * attempt is not the user's exam.
 */
export async function finalizeIfExpired(
  attemptId: string,
): Promise<{ status: AttemptStatus } | null> {
  await auth.protect();
  const user = await requireUser();
  const parsed = examAttemptIdSchema.safeParse(attemptId);
  if (!parsed.success) return null;
  const status = await expireExamIfDue(parsed.data, user.id);
  return status === null ? null : { status };
}

/**
 * Finalizes the user's open exam if it has expired. Every page that shows the user's
 * attempts or progress calls this first, so nothing shows a stale "in progress".
 */
export async function finalizeMyExpiredExam(): Promise<void> {
  await auth.protect();
  const user = await requireUser();
  await expireOpenExamIfDue(user.id);
}

/** Server time and deadline for a running exam, for the player's countdown. */
export async function getExamClock(
  attemptId: string,
): Promise<{ deadline: string | null; serverNow: string } | ActionError> {
  await auth.protect();
  const user = await requireUser();
  const parsed = examAttemptIdSchema.safeParse(attemptId);
  if (!parsed.success) return { error: EXAM_MESSAGES.invalid };
  const exam = await db.attempt.findFirst({
    where: { id: parsed.data, userId: user.id, mode: AttemptMode.EXAM },
    select: { startedAt: true, timeLimitSec: true },
  });
  if (!exam) return { error: EXAM_MESSAGES.notFound };
  return {
    deadline: examDeadline(exam.startedAt, exam.timeLimitSec)?.toISOString() ?? null,
    serverNow: now().toISOString(),
  };
}
