"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { emptyToNull } from "@/lib/import/question-schema";
import { buildPreviewOrders } from "@/lib/quiz/preview";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { applyQuestionOptions, type OptionRow } from "@/server/mutations/questions";
import { resetProgressForQuestion } from "@/server/mutations/progress";
import {
  ADMIN_MESSAGES,
  createQuestionSchema,
  firstErrorMessage,
  previewOptionOrdersSchema,
  setQuestionActiveSchema,
  updateQuestionSchema,
  type CreateQuestionInput,
  type PreviewOptionOrdersInput,
  type SetQuestionActiveInput,
  type UpdateQuestionInput,
} from "./questions.schemas";

export type AdminActionError = { error: string };

/** The admin must confirm before everyone's progress for this question is reset. */
export type NeedsConfirmation = { needsConfirmation: { affectedUsers: number } };

function revalidateQuestion(questionId?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/questions");
  if (questionId) revalidatePath(`/admin/questions/${questionId}`);
}

async function requireSubject(subjectId: string): Promise<boolean> {
  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  return subject !== null;
}

export async function createQuestion(
  input: CreateQuestionInput,
): Promise<{ questionId: string } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = createQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const data = parsed.data;

  if (!(await requireSubject(data.subjectId))) return { error: ADMIN_MESSAGES.subjectNotFound };

  const existing = await db.question.findUnique({
    where: { code: data.code },
    select: { id: true },
  });
  if (existing) return { error: ADMIN_MESSAGES.duplicateCode(data.code) };

  try {
    const created = await db.question.create({
      data: {
        code: data.code,
        subjectId: data.subjectId,
        text: data.text,
        imageUrl: emptyToNull(data.imageUrl),
        explanation: emptyToNull(data.explanation),
        lockOptions: data.lockOptions,
        options: {
          create: data.options.map((option, sortOrder) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            pinned: option.pinned,
            sortOrder,
          })),
        },
      },
      select: { id: true },
    });
    revalidateQuestion(created.id);
    return { questionId: created.id };
  } catch (error) {
    // Lost a race on Question.code with another admin.
    if ((error as { code?: string }).code === "P2002") {
      return { error: ADMIN_MESSAGES.duplicateCode(data.code) };
    }
    throw error;
  }
}

/**
 * Saves the editor's rows. Options are matched BY ID, so moving a row only rewrites
 * sortOrder and an attempt that stored an option id keeps showing the same text.
 *
 * Two things are refused or gated once the question has attempt history: deleting an
 * option (the attempt references it) and silently changing which option is correct —
 * that one asks for confirmation and then, in the same transaction, puts every user's
 * progress for this question back to box 0 and makes it due now.
 */
export async function updateQuestion(
  input: UpdateQuestionInput,
): Promise<{ ok: true; resetUsers: number } | NeedsConfirmation | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = updateQuestionSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const data = parsed.data;

  const question = await db.question.findUnique({
    where: { id: data.questionId },
    select: {
      id: true,
      options: { select: { id: true, isCorrect: true } },
      _count: { select: { attemptItems: true, progress: true } },
    },
  });
  if (!question) return { error: ADMIN_MESSAGES.notFound };
  if (!(await requireSubject(data.subjectId))) return { error: ADMIN_MESSAGES.subjectNotFound };

  // Ownership: every id the form sends back must be an option of THIS question.
  const ownIds = new Set(question.options.map((option) => option.id));
  const rows: OptionRow[] = data.options.map((option) => ({
    optionId: option.optionId ?? null,
    text: option.text,
    isCorrect: option.isCorrect,
    pinned: option.pinned,
  }));
  if (rows.some((row) => row.optionId !== null && !ownIds.has(row.optionId))) {
    return { error: ADMIN_MESSAGES.unknownOption };
  }

  const keptIds = new Set(rows.map((row) => row.optionId).filter((id) => id !== null));
  const removes = question.options.some((option) => !keptIds.has(option.id));
  const hasAttempts = question._count.attemptItems > 0;
  if (removes && hasAttempts) return { error: ADMIN_MESSAGES.cannotDeleteOptions };

  const oldCorrectId = question.options.find((option) => option.isCorrect)?.id ?? null;
  const newCorrectId = rows.find((row) => row.isCorrect)?.optionId ?? null;
  const answerChanged = newCorrectId !== oldCorrectId;
  if (answerChanged && hasAttempts && !data.confirmAnswerChange) {
    return { needsConfirmation: { affectedUsers: question._count.progress } };
  }

  const resetUsers = await db.$transaction(async (tx) => {
    await tx.question.update({
      where: { id: question.id },
      data: {
        subjectId: data.subjectId,
        text: data.text,
        imageUrl: emptyToNull(data.imageUrl),
        explanation: emptyToNull(data.explanation),
        lockOptions: data.lockOptions,
      },
    });
    await applyQuestionOptions(tx, question.id, rows, { allowDelete: !hasAttempts });
    // What these users learnt was graded against the old key, so their schedule for
    // this question is no longer meaningful. Their answer counts and their finished
    // attempts are left untouched.
    return answerChanged ? resetProgressForQuestion(tx, question.id, now()) : 0;
  });

  revalidateQuestion(question.id);
  return { ok: true, resetUsers };
}

/** Idempotent on purpose: the caller states the state it wants, not "flip it". */
export async function setQuestionActive(
  input: SetQuestionActiveInput,
): Promise<{ isActive: boolean } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = setQuestionActiveSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const { questionId, isActive } = parsed.data;

  const { count } = await db.question.updateMany({ where: { id: questionId }, data: { isActive } });
  if (count === 0) return { error: ADMIN_MESSAGES.notFound };

  revalidateQuestion(questionId);
  return { isActive };
}

export type PreviewOrders = { orders: number[][] };

/**
 * Three shuffles of the draft's options, as display positions into the submitted array.
 *
 * Shuffling belongs on the server (and Math.random is never called in a component), so
 * the preview asks for its orders instead of computing them in the browser. It runs the
 * very function an attempt uses, so pinned and locked behaviour is the real thing.
 */
export async function previewOptionOrders(
  input: PreviewOptionOrdersInput,
): Promise<PreviewOrders | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = previewOptionOrdersSchema.safeParse(input);
  if (!parsed.success) return { error: firstErrorMessage(parsed.error) };
  const { lockOptions, options } = parsed.data;

  return { orders: buildPreviewOrders(options, lockOptions, cryptoRandomInt) };
}
