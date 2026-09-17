// Exam timing rules, pure so both the server and the countdown use the same math.

/** Saves and a manual submit are still accepted this long after the deadline. */
export const ANSWER_GRACE_MS = 30_000;

/** Remaining times at which the countdown is announced, once each. */
export const ANNOUNCE_AT_MS = [10 * 60_000, 60_000] as const;

export function examDeadline(startedAt: Date, timeLimitSec: number | null): Date | null {
  if (timeLimitSec === null) return null;
  return new Date(startedAt.getTime() + timeLimitSec * 1000);
}

/** Answers are accepted until the deadline plus the grace period. No deadline: always. */
export function acceptsAnswers(now: Date, deadline: Date | null): boolean {
  return deadline === null || now.getTime() <= deadline.getTime() + ANSWER_GRACE_MS;
}

/**
 * An exam is expired once the grace period is over too, so an auto-submit or save
 * that left the browser at 0:00 still lands instead of racing the finalizer.
 */
export function isExpired(now: Date, deadline: Date | null): boolean {
  return !acceptsAnswers(now, deadline);
}

/** How far the server clock is ahead of this device (negative when behind). */
export function clockOffsetMs(serverNowMs: number, clientNowMs: number): number {
  return serverNowMs - clientNowMs;
}

/** Remaining time in ms, measured on the server's clock, never below zero. */
export function remainingMs(deadlineMs: number, clientNowMs: number, offsetMs: number): number {
  return Math.max(deadlineMs - (clientNowMs + offsetMs), 0);
}

/**
 * The announcement threshold crossed between two readings, if any. When a sleeping tab
 * jumps past several thresholds at once, only the latest (smallest) one is announced.
 */
export function crossedAnnouncement(previousMs: number, currentMs: number): number | null {
  let crossed: number | null = null;
  for (const threshold of ANNOUNCE_AT_MS) {
    if (previousMs > threshold && currentMs <= threshold) crossed = threshold;
  }
  return crossed;
}

/** Time spent on an attempt in whole seconds, capped at the time limit. */
export function timeUsedSeconds(
  startedAt: Date,
  finishedAt: Date | null,
  timeLimitSec: number | null,
): number {
  if (!finishedAt) return 0;
  const used = Math.max(Math.floor((finishedAt.getTime() - startedAt.getTime()) / 1000), 0);
  return timeLimitSec === null ? used : Math.min(used, timeLimitSec);
}
