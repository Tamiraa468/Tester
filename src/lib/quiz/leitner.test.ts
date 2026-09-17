import { describe, expect, it } from "vitest";
import { isMastered, MASTERED_BOX, MAX_BOX, nextProgress, REVIEW_INTERVALS } from "./leitner";

const NOW = new Date("2026-09-16T12:00:00.000Z");
const MINUTE = 60_000;
const minutesAfterNow = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE);

describe("REVIEW_INTERVALS", () => {
  it("is 10 minutes, then 1, 3, 7, 14 and 30 days (in minutes)", () => {
    expect(REVIEW_INTERVALS).toEqual({
      0: 10,
      1: 1440,
      2: 4320,
      3: 10080,
      4: 20160,
      5: 43200,
    });
  });
});

describe("isMastered", () => {
  it("is false below the mastered box and true from it upwards", () => {
    expect(MASTERED_BOX).toBe(3);
    expect(isMastered(0)).toBe(false);
    expect(isMastered(2)).toBe(false);
    expect(isMastered(3)).toBe(true);
    expect(isMastered(MAX_BOX)).toBe(true);
  });
});

describe("nextProgress", () => {
  it("promotes a first correct answer to box 1, due in a day", () => {
    expect(nextProgress(null, true, NOW)).toEqual({
      box: 1,
      correctCount: 1,
      wrongCount: 0,
      lastAnsweredAt: NOW,
      nextReviewAt: minutesAfterNow(1440),
    });
  });

  it("keeps a first wrong answer in box 0, due in ten minutes", () => {
    expect(nextProgress(null, false, NOW)).toEqual({
      box: 0,
      correctCount: 0,
      wrongCount: 1,
      lastAnsweredAt: NOW,
      nextReviewAt: minutesAfterNow(10),
    });
  });

  it("caps promotion at the last box", () => {
    const result = nextProgress({ box: MAX_BOX, correctCount: 9, wrongCount: 2 }, true, NOW);
    expect(result.box).toBe(MAX_BOX);
    expect(result.correctCount).toBe(10);
    expect(result.wrongCount).toBe(2);
    expect(result.nextReviewAt).toEqual(minutesAfterNow(43200));
  });

  it("sends a wrong answer back to box 0 while keeping the correct count", () => {
    const result = nextProgress({ box: 4, correctCount: 7, wrongCount: 1 }, false, NOW);
    expect(result.box).toBe(0);
    expect(result.correctCount).toBe(7);
    expect(result.wrongCount).toBe(2);
    expect(result.nextReviewAt).toEqual(minutesAfterNow(10));
  });

  it("advances one box at a time", () => {
    expect(nextProgress({ box: 1, correctCount: 1, wrongCount: 0 }, true, NOW).box).toBe(2);
    expect(nextProgress({ box: 2, correctCount: 2, wrongCount: 0 }, true, NOW).nextReviewAt).toEqual(
      minutesAfterNow(10080),
    );
  });

  it("stamps lastAnsweredAt with now and never mutates the date passed in", () => {
    const now = new Date(NOW.getTime());
    const result = nextProgress(null, true, now);
    expect(result.lastAnsweredAt.getTime()).toBe(NOW.getTime());
    expect(now.getTime()).toBe(NOW.getTime());
    expect(result.nextReviewAt).not.toBe(now);
  });
});
