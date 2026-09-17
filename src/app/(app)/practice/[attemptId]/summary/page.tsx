import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RetryWrongButton } from "@/components/practice/retry-wrong-button";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { SummaryQuestion } from "@/components/practice/summary-question";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { scoreItems } from "@/lib/quiz/grading";
import { attemptIdSchema } from "@/server/actions/practice.schemas";
import { getAttemptForPlayer } from "@/server/queries/attempts";

export const metadata: Metadata = { title: "Дадлагын дүн" };

export default async function PracticeSummaryPage({
  params,
}: PageProps<"/practice/[attemptId]/summary">) {
  await auth.protect();
  const user = await requireUser();
  const { attemptId } = await params;

  if (!attemptIdSchema.safeParse(attemptId).success) notFound();
  const attempt = await getAttemptForPlayer(attemptId, user.id);
  if (!attempt || attempt.mode !== AttemptMode.PRACTICE) notFound();
  if (attempt.status === AttemptStatus.IN_PROGRESS) redirect(`/practice/${attempt.id}`);

  // Scored from the items rather than Attempt.correctCount, so it is always current.
  const score = scoreItems(
    attempt.items.map((item) => ({
      selectedOptionId: item.selectedOptionId,
      isCorrect: item.result?.isCorrect ?? null,
    })),
  );
  const wrong = attempt.items.filter((item) => item.result && !item.result.isCorrect);
  const unanswered = score.total - score.answered;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Дадлагын дүн</h1>
        {attempt.source && (
          <p className="text-sm text-muted-foreground">{SOURCE_LABELS[attempt.source].label}</p>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Зөв хариулт</span>
              <span className="text-4xl font-semibold tabular-nums">
                {score.correct}
                <span className="text-2xl font-normal text-muted-foreground"> / {score.total}</span>
              </span>
            </div>
            <span className="text-4xl font-semibold tabular-nums">{score.percent}%</span>
          </div>
          <Progress value={score.percent} aria-label="Зөв хариултын хувь" />
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-success/10 p-2">
              <dt className="text-xs text-muted-foreground">Зөв</dt>
              <dd className="text-lg font-semibold text-success tabular-nums">{score.correct}</dd>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2">
              <dt className="text-xs text-muted-foreground">Буруу</dt>
              <dd className="text-lg font-semibold text-destructive tabular-nums">{wrong.length}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Хариулаагүй</dt>
              <dd className="text-lg font-semibold tabular-nums">{unanswered}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        {wrong.length > 0 && <RetryWrongButton attemptId={attempt.id} count={wrong.length} />}
        <Link
          href="/practice"
          className={cn(
            buttonVariants({ variant: wrong.length > 0 ? "outline" : "default", size: "lg" }),
            "h-11 w-full text-base sm:w-auto",
          )}
        >
          Шинэ дадлага
        </Link>
      </div>

      <section aria-labelledby="wrong-heading" className="flex flex-col gap-3">
        <h2 id="wrong-heading" className="text-lg font-semibold">
          Алдсан асуултууд ({wrong.length})
        </h2>
        {wrong.length === 0 ? (
          <p className="text-sm text-muted-foreground">Буруу хариулсан асуулт алга.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {wrong.map((item) => (
              <SummaryQuestion key={item.id} item={item} total={attempt.items.length} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
