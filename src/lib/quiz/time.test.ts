import { describe, expect, it } from "vitest";
import { formatClock } from "./time";

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3599)).toBe("59:59");
  });

  it("adds hours once past an hour", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(5445)).toBe("1:30:45");
  });

  it("floors fractional seconds", () => {
    expect(formatClock(59.9)).toBe("0:59");
  });

  it("never counts below zero", () => {
    expect(formatClock(-1)).toBe("0:00");
    expect(formatClock(Number.NaN)).toBe("0:00");
  });
});
