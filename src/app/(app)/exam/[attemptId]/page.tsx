import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ExamPlayer } from "@/components/exam/exam-player";
import { AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { now } from "@/lib/clock";
import { mn } from "@/lib/i18n/mn";
import { resolvePlayerIndex } from "@/lib/quiz/attempt";
import { finalizeIfExpired } from "@/server/actions/exam";
import { examAttemptIdSchema } from "@/server/actions/exam.schemas";
import { getAttemptForPlayer } from "@/server/queries/attempts";
import { toExamPlayerProps } from "@/server/queries/exam-player";

export const metadata: Metadata = { title: mn.nav.exam };

export default async function ExamAttemptPage({
  params,
  searchParams,
}: PageProps<"/exam/[attemptId]">) {
  await auth.protect();
  const user = await requireUser();
  const { attemptId } = await params;
  const { i } = await searchParams;

  if (!examAttemptIdSchema.safeParse(attemptId).success) notFound();
  // Past the deadline the exam is graded and closed before anything is shown.
  const state = await finalizeIfExpired(attemptId);
  if (!state) notFound();
  if (state.status !== AttemptStatus.IN_PROGRESS) redirect(`/exam/${attemptId}/result`);

  const attempt = await getAttemptForPlayer(attemptId, user.id);
  if (!attempt || attempt.items.length === 0) notFound();
  if (attempt.status !== AttemptStatus.IN_PROGRESS) redirect(`/exam/${attemptId}/result`);

  const index = resolvePlayerIndex(i, attempt.items);
  if (i !== String(index + 1)) redirect(`/exam/${attemptId}?i=${index + 1}`);

  // Only the current item (and the navigator states) reach the browser.
  return <ExamPlayer {...toExamPlayerProps(attempt, index, now())} />;
}
