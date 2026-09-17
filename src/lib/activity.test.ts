import { describe, expect, it } from "vitest";
import {
  activeDayCount,
  buildActivityDays,
  currentStreak,
  totalAnswers,
  type ActivityRow,
} from "./activity";

const row = (day: string, total: number, correct = total): ActivityRow => ({ day, total, correct });

describe("buildActivityDays", () => {
  it("fills the whole window, oldest first, with zeros for silent days", () => {
    const days = buildActivityDays([row("2026-09-17", 5, 4), row("2026-09-15", 2, 1)], "2026-09-17", 4);
    expect(days).toEqual([
      row("2026-09-14", 0, 0),
      row("2026-09-15", 2, 1),
      row("2026-09-16", 0, 0),
      row("2026-09-17", 5, 4),
    ]);
  });

  it("defaults to 30 days and ignores rows outside the window", () => {
    const days = buildActivityDays([row("2026-01-01", 9)], "2026-09-17");
    expect(days).toHaveLength(30);
    expect(totalAnswers(days)).toBe(0);
  });

  it("counts answers and active days in the window", () => {
    const days = buildActivityDays([row("2026-09-17", 5), row("2026-09-16", 3)], "2026-09-17", 5);
    expect(totalAnswers(days)).toBe(8);
    expect(activeDayCount(days)).toBe(2);
  });
});

describe("currentStreak", () => {
  it("counts consecutive days ending today", () => {
    const rows = [row("2026-09-17", 1), row("2026-09-16", 4), row("2026-09-15", 2)];
    expect(currentStreak(rows, "2026-09-17")).toBe(3);
  });

  it("survives a today with no answers yet, ending at yesterday", () => {
    const rows = [row("2026-09-16", 4), row("2026-09-15", 2)];
    expect(currentStreak(rows, "2026-09-17")).toBe(2);
  });

  it("is 0 when the last answer was the day before yesterday", () => {
    expect(currentStreak([row("2026-09-15", 9)], "2026-09-17")).toBe(0);
  });

  it("is 1 for a single day, and 0 with no answers at all", () => {
    expect(currentStreak([row("2026-09-17", 1)], "2026-09-17")).toBe(1);
    expect(currentStreak([row("2026-09-16", 1)], "2026-09-17")).toBe(1);
    expect(currentStreak([], "2026-09-17")).toBe(0);
  });

  it("stops at a gap and ignores days with no graded answer", () => {
    const rows = [row("2026-09-17", 1), row("2026-09-16", 1), row("2026-09-14", 8), row("2026-09-15", 0)];
    expect(currentStreak(rows, "2026-09-17")).toBe(2);
  });

  it("counts across a month boundary", () => {
    const rows = [row("2026-10-01", 1), row("2026-09-30", 1), row("2026-09-29", 1)];
    expect(currentStreak(rows, "2026-10-01")).toBe(3);
  });
});
