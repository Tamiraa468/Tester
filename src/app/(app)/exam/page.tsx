import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AttemptHistory } from "@/components/exam/attempt-history";
import { PresetCard } from "@/components/exam/preset-card";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { finalizeMyExpiredExam } from "@/server/actions/exam";
import { getOpenExam, listExamHistory, listPresetCards } from "@/server/queries/exams";

export const metadata: Metadata = { title: "Шалгалт" };

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
        <h1 className="text-2xl font-semibold">Шалгалт</h1>
        <p className="text-sm text-muted-foreground">
          Жинхэнэ шалгалтын нөхцөлөөр: хугацаатай, дуустал хариу харагдахгүй.
        </p>
      </div>

      {open && (
        <Card className="ring-warning/50">
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="font-semibold">Үргэлжилж буй шалгалт</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {open.presetName ?? "Шалгалт"} · Хариулсан {open.answeredCount} / {open.totalCount}
              </p>
              {open.deadline && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ClockIcon className="size-3.5" aria-hidden="true" />
                  {formatDateTime(open.deadline)} хүртэл
                </p>
              )}
            </div>
            <Link
              href={`/exam/${open.id}`}
              className={cn(buttonVariants(), "h-11 w-full sm:h-9 sm:w-auto")}
            >
              Үргэлжлүүлэх
            </Link>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="presets-heading" className="flex flex-col gap-3">
        <h2 id="presets-heading" className="text-lg font-semibold">
          Шалгалтын төрөл
        </h2>
        {presets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Одоогоор шалгалтын төрөл алга.</p>
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
          emptyText="Та одоогоор шалгалт өгөөгүй байна."
          rows={history.map((exam) => ({
            id: exam.id,
            href: `/exam/${exam.id}/result`,
            title: exam.presetName ?? "Шалгалт",
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
