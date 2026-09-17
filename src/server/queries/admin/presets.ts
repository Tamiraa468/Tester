import "server-only";
import { db } from "@/lib/db";
import { isPresetOffered, planPreset, type BankCounts, type PresetPlan } from "@/lib/quiz/exam-preset";
import { getBankCounts } from "@/server/queries/exams";

export type AdminPreset = {
  id: string;
  name: string;
  questionCount: number;
  timeLimitMin: number;
  isActive: boolean;
  sortOrder: number;
  /** { [subjectId]: count }, or null for "draw from the whole bank". */
  distribution: Record<string, number> | null;
  /** Attempts referencing this preset: above 0 it may only be deactivated. */
  attemptCount: number;
  /** Whether the bank can fill it right now. */
  plan: PresetPlan;
  /** False for a preset that only exists outside production (the seeded quick one). */
  offeredInProduction: boolean;
};

export type AdminPresetsData = {
  presets: AdminPreset[];
  bank: { total: number; bySubject: { id: string; name: string; count: number }[] };
};

function toDistribution(value: unknown): Record<string, number> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, count]) => typeof count === "number" && Number.isInteger(count) && count > 0,
  ) as [string, number][];
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

function bankRows(bank: BankCounts, subjects: { id: string; name: string }[]) {
  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    count: bank.bySubject.get(subject.id)?.count ?? 0,
  }));
}

/** Every preset with its fillability, plus the active bank the editor shows. */
export async function listAdminPresets(): Promise<AdminPresetsData> {
  const [rows, bank, subjects] = await Promise.all([
    db.examPreset.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        questionCount: true,
        timeLimitMin: true,
        isActive: true,
        sortOrder: true,
        distribution: true,
        _count: { select: { attempts: true } },
      },
    }),
    getBankCounts(),
    db.subject.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return {
    presets: rows.map((preset) => ({
      id: preset.id,
      name: preset.name,
      questionCount: preset.questionCount,
      timeLimitMin: preset.timeLimitMin,
      isActive: preset.isActive,
      sortOrder: preset.sortOrder,
      distribution: toDistribution(preset.distribution),
      attemptCount: preset._count.attempts,
      plan: planPreset(preset, bank),
      offeredInProduction: isPresetOffered(preset.id, "production"),
    })),
    bank: { total: bank.total, bySubject: bankRows(bank, subjects) },
  };
}
