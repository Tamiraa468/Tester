import "server-only";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { isPresetOffered, planPreset, type BankCounts, type PresetPlan } from "@/lib/quiz/exam-preset";
import { examDeadline } from "@/lib/quiz/exam-time";

/** Active question counts, in total and per subject. */
export async function getBankCounts(): Promise<BankCounts> {
  const [groups, subjects] = await Promise.all([
    db.question.groupBy({ by: ["subjectId"], where: { isActive: true }, _count: { _all: true } }),
    db.subject.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(subjects.map((subject) => [subject.id, subject.name]));
  const bySubject = new Map(
    groups.map((group) => [
      group.subjectId,
      { name: names.get(group.subjectId) ?? "", count: group._count._all },
    ]),
  );
  return { total: groups.reduce((sum, group) => sum + group._count._all, 0), bySubject };
}

export type PresetCard = {
  id: string;
  name: string;
  questionCount: number;
  timeLimitMin: number;
  plan: PresetPlan;
};

/** Active presets the user may pick, each with whether the bank can fill it. */
export async function listPresetCards(): Promise<PresetCard[]> {
  const [presets, bank] = await Promise.all([
    db.examPreset.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, questionCount: true, timeLimitMin: true, distribution: true },
    }),
    getBankCounts(),
  ]);
  return presets
    .filter((preset) => isPresetOffered(preset.id, process.env.NODE_ENV))
    .map((preset) => ({
      id: preset.id,
      name: preset.name,
      questionCount: preset.questionCount,
      timeLimitMin: preset.timeLimitMin,
      plan: planPreset(preset, bank),
    }));
}

/** The user's exam in progress, if any. Call expireOpenExamIfDue first. */
export async function getOpenExam(userId: string) {
  const exam = await db.attempt.findFirst({
    where: { userId, mode: AttemptMode.EXAM, status: AttemptStatus.IN_PROGRESS },
    select: {
      id: true,
      startedAt: true,
      timeLimitSec: true,
      totalCount: true,
      preset: { select: { name: true } },
      _count: { select: { items: { where: { selectedOptionId: { not: null } } } } },
    },
  });
  if (!exam) return null;
  return {
    id: exam.id,
    presetName: exam.preset?.name ?? null,
    deadline: examDeadline(exam.startedAt, exam.timeLimitSec),
    totalCount: exam.totalCount,
    answeredCount: exam._count.items,
  };
}

/** Finished exams, newest first. */
export async function listExamHistory(userId: string, take = 20) {
  const exams = await db.attempt.findMany({
    where: {
      userId,
      mode: AttemptMode.EXAM,
      status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] },
    },
    orderBy: { startedAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      startedAt: true,
      totalCount: true,
      correctCount: true,
      preset: { select: { name: true } },
    },
  });
  return exams.map((exam) => ({
    id: exam.id,
    status: exam.status,
    startedAt: exam.startedAt,
    presetName: exam.preset?.name ?? null,
    totalCount: exam.totalCount,
    correctCount: exam.correctCount ?? 0,
  }));
}
