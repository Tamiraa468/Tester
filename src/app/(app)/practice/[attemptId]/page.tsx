import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PracticePlayer } from "@/components/practice/practice-player";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { mn } from "@/lib/i18n/mn";
import { resolvePlayerIndex } from "@/lib/quiz/attempt";
import { attemptIdSchema } from "@/server/actions/practice.schemas";
import { getAttemptForPlayer } from "@/server/queries/attempts";

export const metadata: Metadata = { title: mn.nav.practice };

export default async function PracticeAttemptPage({
  params,
  searchParams,
}: PageProps<"/practice/[attemptId]">) {
  await auth.protect();
  const user = await requireUser();
  const { attemptId } = await params;
  const { i } = await searchParams;

  if (!attemptIdSchema.safeParse(attemptId).success) notFound();
  const attempt = await getAttemptForPlayer(attemptId, user.id);
  if (!attempt || attempt.mode !== AttemptMode.PRACTICE || attempt.items.length === 0) {
    notFound();
  }
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    redirect(`/practice/${attempt.id}/summary`);
  }

  const index = resolvePlayerIndex(i, attempt.items);
  // The URL is the source of truth for the current item. Making it explicit means a
  // refresh, or the re-render after an answer, can never jump to a different item.
  if (i !== String(index + 1)) redirect(`/practice/${attempt.id}?i=${index + 1}`);

  const item = attempt.items[index];
  const answeredCount = attempt.items.filter((entry) => entry.selectedOptionId !== null).length;

  // Only the current item goes to the browser; the rest of the attempt stays here.
  return (
    <PracticePlayer
      key={item.id}
      attemptId={attempt.id}
      item={item}
      total={attempt.items.length}
      answeredCount={answeredCount}
      isLast={index === attempt.items.length - 1}
    />
  );
}
