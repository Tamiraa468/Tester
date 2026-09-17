import { describe, expect, it } from "vitest";
import { isPresetOffered, planPreset, PRESET_MESSAGES, type BankCounts } from "./exam-preset";

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
