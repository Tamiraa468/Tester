import { formatClock } from "@/lib/quiz/time";

// Users are in Mongolia; the server's own time zone is irrelevant to them.
const dateTimeFormat = new Intl.DateTimeFormat("mn-MN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ulaanbaatar",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** "1:05:03" or "5:03", as on the exam clock. */
export function formatDuration(seconds: number): string {
  return formatClock(seconds);
}
