/**
 * Day boundaries in the users' time zone. The server runs in UTC and Prisma stores
 * DateTime as UTC, so "today" has to be derived in Asia/Ulaanbaatar explicitly: an
 * answer at 07:00 Ulaanbaatar is 23:00 UTC on the previous day and still belongs to
 * the Mongolian day. The offset comes from Intl (the ICU database), never from a
 * hard-coded +8, so a future change to the zone is followed automatically.
 */

export const UB_TIME_ZONE = "Asia/Ulaanbaatar";

/** A calendar day in Ulaanbaatar, as "YYYY-MM-DD". Also sorts lexicographically. */
export type DayKey = string;

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: UB_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Ulaanbaatar's offset for a given instant, in minutes. "shortOffset" yields e.g.
// "GMT+8"; the sign and the optional minutes are parsed back out of it.
const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: UB_TIME_ZONE,
  timeZoneName: "shortOffset",
});

function offsetMinutes(at: Date): number {
  const name = offsetFormat
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name ?? "");
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** The Ulaanbaatar calendar day an instant falls on. */
export function ubDayKey(at: Date): DayKey {
  return dayFormat.format(at);
}

/** The instant at which an Ulaanbaatar day starts (00:00 local), as a UTC Date. */
export function ubDayStart(day: DayKey): Date {
  const [year, month, date] = day.split("-").map(Number);
  // Guess with a fixed offset, then correct with the offset actually in force then.
  const guess = Date.UTC(year, month - 1, date, 0, 0, 0, 0);
  const first = guess - offsetMinutes(new Date(guess)) * 60_000;
  return new Date(guess - offsetMinutes(new Date(first)) * 60_000);
}

/** The day `count` days after `day` (negative counts go back). */
export function addDays(day: DayKey, count: number): DayKey {
  const [year, month, date] = day.split("-").map(Number);
  const moved = new Date(Date.UTC(year, month - 1, date + count));
  return moved.toISOString().slice(0, 10);
}

/** `count` day keys ending at `day`, oldest first. */
export function dayKeysBack(day: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, index) => addDays(day, index - (count - 1)));
}

/** The day of the month, for a compact chart axis tick. */
export function dayOfMonth(day: DayKey): number {
  return Number(day.slice(8, 10));
}

/**
 * "9-р сарын 17", the way a date is written in Mongolian. Built from the key itself:
 * Intl's mn-MN numeric month renders Roman numerals ("IX/17"), which is hard to scan
 * in a tooltip.
 */
export function formatDayLong(day: DayKey): string {
  return `${Number(day.slice(5, 7))}-р сарын ${dayOfMonth(day)}`;
}
