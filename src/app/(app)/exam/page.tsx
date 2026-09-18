import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { FileTextIcon } from "lucide-react";
import { AttemptHistory } from "@/components/exam/attempt-history";
import { OpenExamBanner } from "@/components/exam/open-exam-banner";
import { PresetCard } from "@/components/exam/preset-card";
import { EmptyState } from "@/components/states/empty-state";
import { AttemptMode } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { mn } from "@/lib/i18n/mn";
import { finalizeMyExpiredExam } from "@/server/actions/exam";
import { getOpenExam, listExamHistory, listPresetCards } from "@/server/queries/exams";

export const metadata: Metadata = { title: mn.nav.exam };

export default async function ExamPage() {
  await auth.protect();
  const user = await requireUser();
  // Lists the user's attempts, so an expired open exam is finalized first.
  await finalizeMyExpiredExam();

  const [presets, open, history] = await Promise.all([
    listPresetCards(),
    getOpenExam(user.id),
    listExamHistory(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{mn.nav.exam}</h1>
        <p className="text-sm text-muted-foreground">
          Жинхэнэ шалгалтын нөхцөлөөр: хугацаатай, дуустал хариу харагдахгүй.
        </p>
      </div>

      {open && <OpenExamBanner exam={open} />}

      <section aria-labelledby="presets-heading" className="flex flex-col gap-3">
        <h2 id="presets-heading" className="text-lg font-semibold">
          Шалгалтын төрөл
        </h2>
        {presets.length === 0 ? (
          <EmptyState icon={FileTextIcon} title={mn.states.emptyPresets} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {presets.map((preset) => (
              <PresetCard key={preset.id} {...preset} hasOpenExam={open !== null} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-lg font-semibold">
          Өмнөх шалгалтууд
        </h2>
        <AttemptHistory
          emptyText={mn.states.emptyExams}
          rows={history.map((exam) => ({
            id: exam.id,
            href: `/exam/${exam.id}/result`,
            mode: AttemptMode.EXAM,
            source: null,
            presetName: exam.presetName,
            status: exam.status,
            startedAt: exam.startedAt,
            correctCount: exam.correctCount,
            totalCount: exam.totalCount,
          }))}
        />
      </section>
    </div>
  );
}
