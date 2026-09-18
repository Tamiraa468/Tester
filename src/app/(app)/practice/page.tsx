import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { mn } from "@/lib/i18n/mn";
import { finalizeMyExpiredExam } from "@/server/actions/exam";
import { listUnfinishedPracticeAttempts } from "@/server/queries/attempts";
import { countsBySource, listSubjects } from "@/server/queries/questions";

export const metadata: Metadata = { title: mn.nav.practice };

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  await auth.protect();
  const user = await requireUser();
  const { subject } = await searchParams;
  // The counts come from QuestionProgress, which an expired exam still has to update.
  await finalizeMyExpiredExam();

  const subjects = await listSubjects();
  // Only a subject from the list is honoured; anything else means "all subjects".
  const subjectId =
    typeof subject === "string" && subjects.some((entry) => entry.id === subject)
      ? subject
      : null;
  const [counts, unfinished] = await Promise.all([
    countsBySource(user.id, subjectId),
    listUnfinishedPracticeAttempts(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{mn.nav.practice}</h1>

      <PracticeSetup subjects={subjects} subjectId={subjectId} counts={counts} />

      {unfinished.length > 0 && (
        <section aria-labelledby="unfinished-heading" className="flex flex-col gap-3">
          <h2 id="unfinished-heading" className="text-lg font-semibold">
            Дуусаагүй {mn.nav.practice.toLowerCase()}
          </h2>
          <ul className="flex flex-col gap-2">
            {unfinished.map((attempt) => (
              <li key={attempt.id}>
                <Card size="sm">
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <p className="font-medium">
                        {attempt.source ? SOURCE_LABELS[attempt.source].label : mn.nav.practice}
                        {attempt.subjectName && (
                          <span className="font-normal text-muted-foreground">
                            {" "}
                            · {attempt.subjectName}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {mn.quiz.answered} {attempt.answeredCount} / {attempt.totalCount} ·{" "}
                        <time dateTime={attempt.startedAt.toISOString()}>
                          {formatDateTime(attempt.startedAt)}
                        </time>
                      </p>
                    </div>
                    <Link
                      href={`/practice/${attempt.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-11 w-full sm:h-8 sm:w-auto",
                      )}
                    >
                      {mn.actions.continue}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
