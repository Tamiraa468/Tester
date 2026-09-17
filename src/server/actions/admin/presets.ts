"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { validatePresetConfig } from "@/lib/quiz/exam-preset";
import { getBankCounts } from "@/server/queries/exams";
import {
  ADMIN_PRESET_MESSAGES,
  createPresetSchema,
  deletePresetSchema,
  setPresetActiveSchema,
  updatePresetSchema,
  type CreatePresetInput,
  type DeletePresetInput,
  type SetPresetActiveInput,
  type UpdatePresetInput,
} from "./presets.schemas";

export type AdminActionError = { error: string };

function revalidatePresets(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/exam-presets");
  revalidatePath("/exam");
}

/**
 * The bank check, shared by create and update: the per-subject counts must add up to
 * questionCount and every subject must have enough ACTIVE questions. It ends in
 * planPreset(), the very function /exam and startExam() use, so the admin can never
 * save a preset the exam page would then refuse to offer.
 */
async function checkConfig(preset: {
  questionCount: number;
  distribution: Record<string, number> | null;
}): Promise<string | null> {
  const [bank, subjects] = await Promise.all([
    getBankCounts(),
    db.subject.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const result = validatePresetConfig(preset, bank, names);
  return result.ok ? null : result.reason;
}

export async function createPreset(
  input: CreatePresetInput,
): Promise<{ presetId: string } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = createPresetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const problem = await checkConfig(data);
  if (problem) return { error: problem };

  const created = await db.examPreset.create({
    data: {
      name: data.name,
      questionCount: data.questionCount,
      timeLimitMin: data.timeLimitMin,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      distribution: (data.distribution ?? Prisma.DbNull) as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  revalidatePresets();
  return { presetId: created.id };
}

export async function updatePreset(
  input: UpdatePresetInput,
): Promise<{ ok: true } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = updatePresetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { presetId, ...data } = parsed.data;

  const preset = await db.examPreset.findUnique({ where: { id: presetId }, select: { id: true } });
  if (!preset) return { error: ADMIN_PRESET_MESSAGES.notFound };

  const problem = await checkConfig(data);
  if (problem) return { error: problem };

  await db.examPreset.update({
    where: { id: presetId },
    data: {
      name: data.name,
      questionCount: data.questionCount,
      timeLimitMin: data.timeLimitMin,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      distribution: (data.distribution ?? Prisma.DbNull) as Prisma.InputJsonValue,
    },
  });
  revalidatePresets();
  return { ok: true };
}

/** Idempotent: the caller states the state it wants, not "flip it". */
export async function setPresetActive(
  input: SetPresetActiveInput,
): Promise<{ isActive: boolean } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = setPresetActiveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { presetId, isActive } = parsed.data;

  const { count } = await db.examPreset.updateMany({ where: { id: presetId }, data: { isActive } });
  if (count === 0) return { error: ADMIN_PRESET_MESSAGES.notFound };

  revalidatePresets();
  return { isActive };
}

/**
 * Deletes a preset nobody has sat. Once an attempt references it, deleting would null
 * out Attempt.presetId (the relation is SetNull) and the exam history would lose the
 * name it was taken under, so such a preset may only be deactivated.
 */
export async function deletePreset(
  input: DeletePresetInput,
): Promise<{ ok: true } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = deletePresetSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { presetId } = parsed.data;

  const outcome = await db.$transaction(async (tx) => {
    const preset = await tx.examPreset.findUnique({ where: { id: presetId }, select: { id: true } });
    if (!preset) return { error: ADMIN_PRESET_MESSAGES.notFound };

    // Counted inside the transaction, so an exam cannot start in between.
    const attempts = await tx.attempt.count({ where: { presetId } });
    if (attempts > 0) return { error: ADMIN_PRESET_MESSAGES.hasAttempts(attempts) };

    await tx.examPreset.delete({ where: { id: presetId } });
    return { ok: true } as const;
  });

  if ("error" in outcome) return outcome;
  revalidatePresets();
  return { ok: true };
}
