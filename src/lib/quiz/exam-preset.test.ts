import { describe, expect, it } from "vitest";
import {
  isPresetOffered,
  planPreset,
  PRESET_MESSAGES,
  validatePresetConfig,
  type BankCounts,
} from "./exam-preset";

const bank: BankCounts = {
  total: 18,
  bySubject: new Map([
    ["s1", { name: "Статистик", count: 6 }],
    ["s2", { name: "Философи", count: 5 }],
    ["s3", { name: "Эрх зүй", count: 7 }],
  ]),
};

describe("planPreset without a distribution", () => {
  it("draws from the whole bank when it is big enough", () => {
    expect(planPreset({ questionCount: 18, distribution: null }, bank)).toEqual({
      ok: true,
      total: 18,
      perSubject: null,
    });
    expect(planPreset({ questionCount: 3, distribution: undefined }, bank).ok).toBe(true);
  });

  it("explains a bank that is too small", () => {
    expect(planPreset({ questionCount: 100, distribution: null }, bank)).toEqual({
      ok: false,
      reason: "Асуултын сан хүрэлцэхгүй: 100 асуулт хэрэгтэй, 18 байна.",
    });
  });

  it("rejects a non-positive question count", () => {
    for (const questionCount of [0, -1, 1.5]) {
      expect(planPreset({ questionCount, distribution: null }, bank)).toEqual({
        ok: false,
        reason: PRESET_MESSAGES.invalidConfig,
      });
    }
  });
});

describe("planPreset with a distribution", () => {
  it("returns the per-subject counts", () => {
    expect(planPreset({ questionCount: 10, distribution: { s1: 5, s2: 5 } }, bank)).toEqual({
      ok: true,
      total: 10,
      perSubject: [
        { subjectId: "s1", count: 5 },
        { subjectId: "s2", count: 5 },
      ],
    });
  });

  it("names every subject that is short", () => {
    const plan = planPreset({ questionCount: 16, distribution: { s1: 8, s2: 6, s3: 2 } }, bank);
    expect(plan).toEqual({
      ok: false,
      reason: "Статистик: 8 асуулт хэрэгтэй, 6 байна. Философи: 6 асуулт хэрэгтэй, 5 байна.",
    });
  });

  it("rejects counts that do not add up to the question count", () => {
    expect(planPreset({ questionCount: 10, distribution: { s1: 5, s2: 4 } }, bank)).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.invalidConfig,
    });
  });

  it("rejects an unknown or empty subject", () => {
    expect(planPreset({ questionCount: 5, distribution: { gone: 5 } }, bank).ok).toBe(false);
    expect(planPreset({ questionCount: 5, distribution: {} }, bank).ok).toBe(false);
  });

  it("rejects malformed JSON shapes", () => {
    for (const distribution of [[5], "s1:5", { s1: "5" }, { s1: 0 }, { s1: 2.5 }, 5]) {
      expect(planPreset({ questionCount: 5, distribution }, bank), JSON.stringify(distribution)).toEqual({
        ok: false,
        reason: PRESET_MESSAGES.invalidConfig,
      });
    }
  });
});

describe("isPresetOffered", () => {
  it("hides dev-only presets in production only", () => {
    expect(isPresetOffered("seed-preset-quick", "production")).toBe(false);
    expect(isPresetOffered("seed-preset-quick", "development")).toBe(true);
    expect(isPresetOffered("seed-preset-quick", undefined)).toBe(true);
    expect(isPresetOffered("seed-preset-default", "production")).toBe(true);
  });
});

describe("validatePresetConfig", () => {
  const names = new Map([
    ["s1", "Статистик"],
    ["s2", "Философи"],
    ["s3", "Эрх зүй"],
    // A subject that exists but has no active questions at all, so the bank omits it.
    ["s4", "Хоосон"],
  ]);
  const check = (questionCount: number, distribution: Record<string, number> | null) =>
    validatePresetConfig({ questionCount, distribution }, bank, names);

  it("accepts a preset the bank can fill", () => {
    expect(check(10, null)).toEqual({ ok: true });
    expect(check(10, { s1: 5, s2: 5 })).toEqual({ ok: true });
  });

  it("says what the counts add up to when they do not match", () => {
    expect(check(10, { s1: 4, s2: 4 })).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.distributionSum(8, 10),
    });
    expect(check(10, { s1: 6, s2: 5 })).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.distributionSum(11, 10),
    });
  });

  it("names every subject that is short of ACTIVE questions", () => {
    expect(check(12, { s1: 7, s2: 5 })).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.subjectTooSmall("Статистик", 7, 6),
    });
    // A subject with no active questions is missing from the bank, and counts as zero.
    expect(check(4, { s4: 4 })).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.subjectTooSmall("Хоосон", 4, 0),
    });
    const both = check(14, { s1: 7, s2: 7 });
    expect(both.ok).toBe(false);
    expect(both.ok || both.reason).toContain("Статистик");
    expect(both.ok || both.reason).toContain("Философи");
  });

  it("refuses a subject that does not exist and an empty distribution", () => {
    expect(check(5, { nope: 5 })).toEqual({ ok: false, reason: PRESET_MESSAGES.subjectNotFound });
    expect(check(5, {})).toEqual({ ok: false, reason: PRESET_MESSAGES.invalidConfig });
  });

  it("refuses more questions than the whole bank holds", () => {
    expect(check(19, null)).toEqual({
      ok: false,
      reason: PRESET_MESSAGES.bankTooSmall(19, 18),
    });
  });

  it("refuses a question count that is not a positive integer", () => {
    expect(check(0, null).ok).toBe(false);
    expect(check(-3, null).ok).toBe(false);
    expect(check(2.5, null).ok).toBe(false);
  });

  it("never accepts what planPreset would refuse", () => {
    const cases: (Record<string, number> | null)[] = [null, { s1: 5, s2: 5 }, { s1: 6, s2: 5, s3: 7 }];
    for (const distribution of cases) {
      const total = distribution
        ? Object.values(distribution).reduce((sum, count) => sum + count, 0)
        : 10;
      if (validatePresetConfig({ questionCount: total, distribution }, bank, names).ok) {
        expect(planPreset({ questionCount: total, distribution }, bank).ok).toBe(true);
      }
    }
  });
});
