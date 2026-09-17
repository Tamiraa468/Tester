/**
 * Exam clock, as m:ss (or h:mm:ss past an hour). Seconds are floored and a negative
 * remainder reads 0:00, so an expired attempt never shows a negative countdown.
 */
export function formatClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(Math.floor(totalSeconds), 0) : 0;
  const seconds = safe % 60;
  const minutes = Math.floor(safe / 60) % 60;
  const hours = Math.floor(safe / 3600);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
