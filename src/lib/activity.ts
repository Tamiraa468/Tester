/**
 * Turns the per-day answer counts of src/server/queries/progress.ts into the chart's
 * window and the current streak. Pure: the caller passes the day rows and today's key
 * (both already in Asia/Ulaanbaatar), so this can be unit-tested without a clock.
 */
import { addDays, dayKeysBack, type DayKey } from "@/lib/date";

export type ActivityRow = { day: DayKey; total: number; correct: number };

/** Days shown on the dashboard chart. */
export const ACTIVITY_WINDOW_DAYS = 30;

/**
 * Exactly `days` entries ending at `today`, oldest first, with the days the user did
 * not answer anything filled in as zero, so the chart has a continuous axis.
 */
export function buildActivityDays(
  rows: readonly ActivityRow[],
  today: DayKey,
  days: number = ACTIVITY_WINDOW_DAYS,
): ActivityRow[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return dayKeysBack(today, days).map(
    (day) => byDay.get(day) ?? { day, total: 0, correct: 0 },
  );
}

/**
 * Consecutive days with at least one graded answer, ending today or yesterday. Today
 * not being answered yet does not end a streak; the day before yesterday does.
 */
export function currentStreak(rows: readonly ActivityRow[], today: DayKey): number {
  const active = new Set(rows.filter((row) => row.total > 0).map((row) => row.day));
  let day = active.has(today) ? today : addDays(today, -1);
  if (!active.has(day)) return 0;

  let streak = 0;
  while (active.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Days in the window on which the user answered at least one question. */
export function activeDayCount(days: readonly ActivityRow[]): number {
  return days.filter((day) => day.total > 0).length;
}

/** Graded answers in the window. */
export function totalAnswers(days: readonly ActivityRow[]): number {
  return days.reduce((sum, day) => sum + day.total, 0);
}
