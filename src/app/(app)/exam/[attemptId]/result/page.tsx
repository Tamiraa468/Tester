import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExamResultList } from "@/components/exam/exam-result-list";
import { RetryWrongButton } from "@/components/practice/retry-wrong-button";
import { AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { mn } from "@/lib/i18n/mn";
import { formatDateTime, formatDuration } from "@/lib/format";
import { subjectBreakdown } from "@/lib/quiz/exam-result";
import { timeUsedSeconds } from "@/lib/quiz/exam-time";
import { finalizeIfExpired } from "@/server/actions/exam";
import { examAttemptIdSchema } from "@/server/actions/exam.schemas";
import { getAttemptForPlayer } from "@/server/queries/attempts";

export const metadata: Metadata = { title: "Шалгалтын дүн" };

export default async function ExamResultPage({
  params,
}: PageProps<"/exam/[attemptId]/result">) {
  await auth.protect();
  const user = await requireUser();
  const { attemptId } = await params;

  if (!examAttemptIdSchema.safeParse(attemptId).success) notFound();
  const state = await finalizeIfExpired(attemptId);
  if (!state) notFound();
  // Nothing from the result is loaded for an exam that is still running.
  if (state.status === AttemptStatus.IN_PROGRESS) redirect(`/exam/${attemptId}`);

  const attempt = await getAttemptForPlayer(attemptId, user.id);
  if (!attempt || attempt.status === AttemptStatus.IN_PROGRESS) notFound();

  const { rows, total } = subjectBreakdown(
    attempt.items.map((item) => ({
      subjectName: item.subjectName,
      answered: item.selectedOptionId !== null,
      isCorrect: item.result?.isCorrect === true,
    })),
  );
  const missed = total.total - total.correct;
  const used = timeUsedSeconds(attempt.startedAt, attempt.submittedAt, attempt.timeLimitSec);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Шалгалтын дүн</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{attempt.presetName ?? mn.nav.exam}</span>·
          <time dateTime={attempt.startedAt.toISOString()}>{formatDateTime(attempt.startedAt)}</time>
          {attempt.status === AttemptStatus.EXPIRED ? (
            <Badge variant="outline" className="border-warning text-warning">
              Хугацаа дууссан тул автоматаар дууссан
            </Badge>
          ) : (
            <Badge variant="secondary">Дууссан</Badge>
          )}
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Зөв хариулт</span>
              <span className="text-4xl font-semibold tabular-nums">
                {total.correct}
                <span className="text-2xl font-normal text-muted-foreground"> / {total.total}</span>
              </span>
            </div>
            <span className="text-4xl font-semibold tabular-nums">{total.percent}%</span>
          </div>
          <Progress value={total.percent} aria-label="Зөв хариултын хувь" />
          <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-success/10 p-2">
              <dt className="text-xs text-muted-foreground">Зөв</dt>
              <dd className="text-lg font-semibold text-success tabular-nums">{total.correct}</dd>
            </div>
            <div className="rounded-lg bg-destructive/10 p-2">
              <dt className="text-xs text-muted-foreground">Буруу</dt>
              <dd className="text-lg font-semibold text-destructive tabular-nums">
                {total.answered - total.correct}
              </dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Хариулаагүй</dt>
              <dd className="text-lg font-semibold tabular-nums">{total.total - total.answered}</dd>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <dt className="text-xs text-muted-foreground">Зарцуулсан хугацаа</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatDuration(used)}
                {attempt.timeLimitSec !== null && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {" "}
                    / {formatDuration(attempt.timeLimitSec)}
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section aria-labelledby="subjects-heading" className="flex flex-col gap-3">
        <h2 id="subjects-heading" className="text-lg font-semibold">
          Судлагдахуунаар
        </h2>
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Судлагдахуун</TableHead>
                <TableHead className="text-right">Зөв</TableHead>
                <TableHead className="text-right">Хариулсан</TableHead>
                <TableHead className="text-right">Нийт</TableHead>
                <TableHead className="text-right">Хувь</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.subject}>
                  <TableCell className="whitespace-normal">{row.subject}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.correct}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.answered}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.percent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>{total.subject}</TableCell>
                <TableCell className="text-right tabular-nums">{total.correct}</TableCell>
                <TableCell className="text-right tabular-nums">{total.answered}</TableCell>
                <TableCell className="text-right tabular-nums">{total.total}</TableCell>
                <TableCell className="text-right tabular-nums">{total.percent}%</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        {missed > 0 && (
          <RetryWrongButton attemptId={attempt.id} count={missed} label="Алдсануудаа дадлага болгох" />
        )}
        <Link
          href="/exam"
          className={cn(
            buttonVariants({ variant: missed > 0 ? "outline" : "default", size: "lg" }),
            "h-11 w-full text-base sm:w-auto",
          )}
        >
          Шалгалтууд руу буцах
        </Link>
      </div>

      <ExamResultList items={attempt.items} total={attempt.items.length} />
    </div>
  );
}
