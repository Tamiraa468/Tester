// Whether an exam preset can be filled from the active question bank. Pure: the
// /exam page shows the reason on the card, and startExam checks again before picking.

import { z } from "zod";

/** Seeded presets that exist only for manual testing; never offered in production. */
export const DEV_ONLY_PRESET_IDS: readonly string[] = ["seed-preset-quick"];

export function isPresetOffered(presetId: string, nodeEnv: string | undefined): boolean {
  return nodeEnv !== "production" || !DEV_ONLY_PRESET_IDS.includes(presetId);
}

/** ExamPreset.distribution: { [subjectId]: count }. */
const distributionSchema = z.record(z.string().min(1), z.int().positive());

export type BankCounts = {
  total: number;
  /** Active questions per subject id, with the subject's name. */
  bySubject: ReadonlyMap<string, { name: string; count: number }>;
};

export type PresetPlan =
  | { ok: true; total: number; perSubject: { subjectId: string; count: number }[] | null }
  | { ok: false; reason: string };

export const PRESET_MESSAGES = {
  invalidConfig: "Шалгалтын тохиргоо буруу байна.",
  subjectNotFound: "Сонгосон судлагдахууны нэг нь олдсонгүй.",
  distributionSum: (sum: number, total: number) =>
    `Судлагдахуунуудын нийлбэр ${sum} байна; асуултын тоо ${total} байх ёстой.`,
  bankTooSmall: (need: number, have: number) =>
    `Асуултын сан хүрэлцэхгүй: ${need} асуулт хэрэгтэй, ${have} байна.`,
  subjectTooSmall: (name: string, need: number, have: number) =>
    `${name}: ${need} асуулт хэрэгтэй, ${have} байна.`,
} as const;

export function planPreset(
  preset: { questionCount: number; distribution: unknown },
  bank: BankCounts,
): PresetPlan {
  const total = preset.questionCount;
  if (!Number.isInteger(total) || total < 1) {
    return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
  }

  if (preset.distribution === null || preset.distribution === undefined) {
    return total <= bank.total
      ? { ok: true, total, perSubject: null }
      : { ok: false, reason: PRESET_MESSAGES.bankTooSmall(total, bank.total) };
  }

  const parsed = distributionSchema.safeParse(preset.distribution);
  if (!parsed.success) return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
  const entries = Object.entries(parsed.data);
  const sum = entries.reduce((acc, [, count]) => acc + count, 0);
  // A subject that has no active questions is absent from bySubject; a subject id that
  // does not exist at all is a configuration error, but both simply cannot be filled.
  if (entries.length === 0 || sum !== total) {
    return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
  }

  const shortages: string[] = [];
  for (const [subjectId, need] of entries) {
    const subject = bank.bySubject.get(subjectId);
    if (!subject) return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
    if (subject.count < need) {
      shortages.push(PRESET_MESSAGES.subjectTooSmall(subject.name, need, subject.count));
    }
  }
  if (shortages.length > 0) return { ok: false, reason: shortages.join(" ") };

  return {
    ok: true,
    total,
    perSubject: entries.map(([subjectId, count]) => ({ subjectId, count })),
  };
}

/**
 * The admin form's check for a preset, with a message that says exactly what is wrong
 * (planPreset answers the /exam page, where "тохиргоо буруу" is all a student needs).
 *
 * It ends by running planPreset itself, so a preset can never be saved that the exam
 * page would then refuse to offer.
 */
export function validatePresetConfig(
  preset: { questionCount: number; distribution: Record<string, number> | null },
  bank: BankCounts,
  subjectNames: ReadonlyMap<string, string>,
): { ok: true } | { ok: false; reason: string } {
  const total = preset.questionCount;
  if (!Number.isInteger(total) || total < 1) {
    return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
  }

  if (preset.distribution === null) {
    return total <= bank.total
      ? { ok: true }
      : { ok: false, reason: PRESET_MESSAGES.bankTooSmall(total, bank.total) };
  }

  const entries = Object.entries(preset.distribution);
  if (entries.length === 0) return { ok: false, reason: PRESET_MESSAGES.invalidConfig };
  if (entries.some(([subjectId]) => !subjectNames.has(subjectId))) {
    return { ok: false, reason: PRESET_MESSAGES.subjectNotFound };
  }

  const sum = entries.reduce((acc, [, count]) => acc + count, 0);
  if (sum !== total) return { ok: false, reason: PRESET_MESSAGES.distributionSum(sum, total) };

  const shortages: string[] = [];
  for (const [subjectId, need] of entries) {
    // A subject with no active questions at all is absent from bySubject.
    const have = bank.bySubject.get(subjectId)?.count ?? 0;
    if (have < need) {
      shortages.push(
        PRESET_MESSAGES.subjectTooSmall(subjectNames.get(subjectId) ?? subjectId, need, have),
      );
    }
  }
  if (shortages.length > 0) return { ok: false, reason: shortages.join(" ") };

  const plan = planPreset(preset, bank);
  return plan.ok ? { ok: true } : { ok: false, reason: plan.reason };
}
