import "server-only";
import { AttemptMode, AttemptStatus, type AttemptSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { toPlayerItem, type PlayerItem } from "./player-item";

export type PlayerAttempt = {
  id: string;
  mode: AttemptMode;
  status: AttemptStatus;
  source: AttemptSource | null;
  presetName: string | null;
  startedAt: Date;
  submittedAt: Date | null;
  timeLimitSec: number | null;
  items: PlayerItem[];
};

/** Just enough to route a request before any item data is loaded. */
export async function getAttemptStatus(attemptId: string, userId: string) {
  return db.attempt.findFirst({
    where: { id: attemptId, userId },
    select: { id: true, mode: true, status: true },
  });
}

/**
 * The attempt as the player may see it, or null when it is not this user's. Items are
 * built by toPlayerItem, which strips all correctness data from items that may not be
 * revealed yet; for revealed items it restores the stored result, so a refresh shows
 * the same feedback.
 */
export async function getAttemptForPlayer(
  attemptId: string,
  userId: string,
): Promise<PlayerAttempt | null> {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, userId },
    select: {
      id: true,
      mode: true,
      status: true,
      source: true,
      startedAt: true,
      submittedAt: true,
      timeLimitSec: true,
      preset: { select: { name: true } },
      items: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          optionOrder: true,
          selectedOptionId: true,
          isCorrect: true,
          flagged: true,
          question: {
            select: {
              id: true,
              text: true,
              imageUrl: true,
              explanation: true,
              subject: { select: { name: true } },
              options: { select: { id: true, text: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) return null;

  const bookmarks = await db.bookmark.findMany({
    where: { userId, questionId: { in: attempt.items.map((item) => item.question.id) } },
    select: { questionId: true },
  });
  const bookmarked = new Set(bookmarks.map((bookmark) => bookmark.questionId));

  return {
    id: attempt.id,
    mode: attempt.mode,
    status: attempt.status,
    source: attempt.source,
    presetName: attempt.preset?.name ?? null,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    timeLimitSec: attempt.timeLimitSec,
    items: attempt.items.map((item) =>
      toPlayerItem(item, {
        mode: attempt.mode,
        status: attempt.status,
        bookmarked: bookmarked.has(item.question.id),
      }),
    ),
  };
}

/** The user's practice attempts that are still open, newest first. */
export async function listUnfinishedPracticeAttempts(userId: string) {
  const attempts = await db.attempt.findMany({
    where: { userId, mode: AttemptMode.PRACTICE, status: AttemptStatus.IN_PROGRESS },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      id: true,
      source: true,
      totalCount: true,
      startedAt: true,
      subject: { select: { name: true } },
      _count: { select: { items: { where: { selectedOptionId: { not: null } } } } },
    },
  });
  return attempts.map((attempt) => ({
    id: attempt.id,
    source: attempt.source,
    subjectName: attempt.subject?.name ?? null,
    totalCount: attempt.totalCount,
    answeredCount: attempt._count.items,
    startedAt: attempt.startedAt,
  }));
}
