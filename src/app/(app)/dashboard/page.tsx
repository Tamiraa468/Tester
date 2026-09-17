import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { FlameIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { formatPercent, KpiCard } from "@/components/dashboard/kpi-card";
import { SubjectProgress } from "@/components/dashboard/subject-progress";
import { AttemptHistory } from "@/components/exam/attempt-history";
import { OpenExamBanner } from "@/components/exam/open-exam-banner";
import { StartPracticeButton } from "@/components/practice/start-practice-button";
import { AttemptMode, AttemptSource } from "@/generated/prisma/enums";
import { activeDayCount, totalAnswers } from "@/lib/activity";
import { requireUser } from "@/lib/auth";
import { finalizeMyExpiredExam } from "@/server/actions/exam";
import { getOpenExam } from "@/server/queries/exams";
import { getDashboardData, isNewUser } from "@/server/queries/progress";

export const metadata: Metadata = { title: "Хяналтын самбар" };

export default async function DashboardPage() {
  // Layouts don't re-run on client navigation, so each page checks auth itself.
  await auth.protect();
  const user = await requireUser();
  // Shows the user's progress and attempts, so an expired open exam is graded first.
  await finalizeMyExpiredExam();

  const [data, open] = await Promise.all([getDashboardData(user.id), getOpenExam(user.id)]);
  const { bank, subjects, reviewCounts, activity, recentAttempts } = data;
  const dueCount = reviewCounts[AttemptSource.DUE];
  const answers = totalAnswers(activity.days);
  const activeDays = activeDayCount(activity.days);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Хяналтын самбар</h1>
        <p className="text-sm text-muted-foreground">Ахиц дэвшил, давтах асуултууд.</p>
      </div>

      {open && <OpenExamBanner exam={open} />}

      <section aria-labelledby="kpi-heading" className="flex flex-col gap-3">
        <h2 id="kpi-heading" className="sr-only">
          Ерөнхий үзүүлэлт
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="Нийт асуулт" value={String(bank.total)} />
          <KpiCard
            label="Үзсэн"
            value={String(bank.seen)}
            hint={bank.total > 0 ? `${Math.round((bank.seen / bank.total) * 100)}%` : undefined}
          />
          <KpiCard
            label="Цээжилсэн"
            value={String(bank.mastered)}
            hint={bank.total > 0 ? `${Math.round((bank.mastered / bank.total) * 100)}%` : undefined}
          />
          <KpiCard
            label="Нарийвчлал"
            value={formatPercent(bank.accuracy)}
            hint={bank.answered > 0 ? `${bank.correct}/${bank.answered} хариулт` : undefined}
          />
        </div>
      </section>

      {isNewUser(data) ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <div className="flex flex-col gap-1">
              <p className="font-semibold">Эхлэхэд бэлэн үү?</p>
              <p className="text-sm text-muted-foreground">
                Эхний дадлагаа хийснээр ахиц дэвшил, давтлагын хуваарь энд харагдана.
              </p>
            </div>
            <Link
              href="/practice"
              className={cn(buttonVariants({ size: "lg" }), "h-11 w-full text-base sm:w-auto")}
            >
              Эхний дадлагаа эхлүүлэх
            </Link>
          </CardContent>
        </Card>
      ) : (
        dueCount > 0 && (
          <Card className="ring-primary/20">
            <CardContent className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-lg font-semibold tabular-nums">
                  Өнөөдөр давтах: {dueCount} асуулт
                </p>
                <p className="text-sm text-muted-foreground">
                  Давтлагын хуваарийн дагуу хугацаа нь болсон асуултууд.
                </p>
              </div>
              <StartPracticeButton
                source={AttemptSource.DUE}
                available={dueCount}
                size="lg"
                className="h-11 w-full text-base sm:w-auto"
              >
                Давтаж эхлэх
              </StartPracticeButton>
            </CardContent>
          </Card>
        )
      )}

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-3">
        <h2 id="subjects-heading" className="text-lg font-semibold">
          Судлагдахуун тус бүрээр
        </h2>
        <p className="text-sm text-muted-foreground">Сул талаас нь эхлүүлэн эрэмбэлэв.</p>
        <SubjectProgress subjects={subjects} />
      </section>

      <section aria-labelledby="activity-heading" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="activity-heading" className="text-lg font-semibold">
            Сүүлийн 30 хоног
          </h2>
          <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
            <FlameIcon
              className={cn("size-4", activity.streak > 0 ? "text-warning" : "text-muted-foreground")}
              aria-hidden="true"
            />
            {activity.streak > 0
              ? `${activity.streak} хоног дараалан`
              : "Дараалсан өдөр алга"}
          </p>
        </div>
        <ActivityChart
          days={activity.days}
          summary={`Сүүлийн 30 хоногт ${answers} хариулт, ${activeDays} идэвхтэй өдөр.`}
        />
      </section>

      <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Сүүлийн оролдлогууд
        </h2>
        <AttemptHistory
          emptyText="Та одоогоор дадлага, шалгалт дуусгаагүй байна."
          rows={recentAttempts.map((attempt) => ({
            id: attempt.id,
            href:
              attempt.mode === AttemptMode.EXAM
                ? `/exam/${attempt.id}/result`
                : `/practice/${attempt.id}/summary`,
            mode: attempt.mode,
            source: attempt.source,
            presetName: attempt.presetName,
            subjectName: attempt.subjectName,
            status: attempt.status,
            startedAt: attempt.startedAt,
            correctCount: attempt.correctCount,
            totalCount: attempt.totalCount,
          }))}
        />
      </section>
    </div>
  );
}
