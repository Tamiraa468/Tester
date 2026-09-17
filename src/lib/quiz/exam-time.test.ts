import { describe, expect, it } from "vitest";
import {
  acceptsAnswers,
  ANSWER_GRACE_MS,
  clockOffsetMs,
  crossedAnnouncement,
  examDeadline,
  isExpired,
  remainingMs,
  timeUsedSeconds,
} from "./exam-time";

const START = new Date("2026-09-17T02:00:00.000Z");
const at = (ms: number) => new Date(START.getTime() + ms);
const MIN = 60_000;

describe("examDeadline", () => {
  it("adds the time limit to the start", () => {
    expect(examDeadline(START, 90 * 60)).toEqual(at(90 * MIN));
  });

  it("is null without a limit", () => {
    expect(examDeadline(START, null)).toBeNull();
  });
});

describe("acceptsAnswers / isExpired", () => {
  const deadline = at(10 * MIN);

  it("accepts until the deadline plus the grace period, inclusive", () => {
    expect(acceptsAnswers(at(0), deadline)).toBe(true);
    expect(acceptsAnswers(deadline, deadline)).toBe(true);
    expect(acceptsAnswers(at(10 * MIN + ANSWER_GRACE_MS), deadline)).toBe(true);
    expect(isExpired(at(10 * MIN + ANSWER_GRACE_MS), deadline)).toBe(false);
  });

  it("rejects after the grace period", () => {
    expect(acceptsAnswers(at(10 * MIN + ANSWER_GRACE_MS + 1), deadline)).toBe(false);
    expect(isExpired(at(10 * MIN + ANSWER_GRACE_MS + 1), deadline)).toBe(true);
  });

  it("never expires without a deadline", () => {
    expect(acceptsAnswers(at(10_000 * MIN), null)).toBe(true);
    expect(isExpired(at(10_000 * MIN), null)).toBe(false);
  });
});

describe("clockOffsetMs / remainingMs", () => {
  it("measures remaining time on the server's clock, whatever the device says", () => {
    const deadlineMs = at(10 * MIN).getTime();
    const serverNow = at(4 * MIN).getTime();
    // Device clock is an hour behind; the offset cancels it out.
    const deviceNow = serverNow - 60 * MIN;
    const offset = clockOffsetMs(serverNow, deviceNow);
    expect(offset).toBe(60 * MIN);
    expect(remainingMs(deadlineMs, deviceNow, offset)).toBe(6 * MIN);
    expect(remainingMs(deadlineMs, deviceNow + MIN, offset)).toBe(5 * MIN);
  });

  it("never goes below zero", () => {
    expect(remainingMs(1000, 5000, 0)).toBe(0);
  });
});

describe("crossedAnnouncement", () => {
  it("announces 10 and 1 minutes when crossed", () => {
    expect(crossedAnnouncement(10 * MIN + 1, 10 * MIN)).toBe(10 * MIN);
    expect(crossedAnnouncement(MIN + 500, MIN - 500)).toBe(MIN);
  });

  it("does not announce without crossing, e.g. on the first reading", () => {
    expect(crossedAnnouncement(5 * MIN, 5 * MIN)).toBeNull();
    expect(crossedAnnouncement(10 * MIN, 9 * MIN)).toBeNull();
    expect(crossedAnnouncement(20 * MIN, 19 * MIN)).toBeNull();
  });

  it("announces only the latest threshold after a jump", () => {
    expect(crossedAnnouncement(11 * MIN, 30_000)).toBe(MIN);
  });
});

describe("timeUsedSeconds", () => {
  it("counts whole seconds and caps at the limit", () => {
    expect(timeUsedSeconds(START, at(125_900), 600)).toBe(125);
    expect(timeUsedSeconds(START, at(700_000), 600)).toBe(600);
    expect(timeUsedSeconds(START, at(700_000), null)).toBe(700);
  });

  it("is zero when unfinished or when the clock went backwards", () => {
    expect(timeUsedSeconds(START, null, 600)).toBe(0);
    expect(timeUsedSeconds(START, at(-5000), 600)).toBe(0);
  });
});
