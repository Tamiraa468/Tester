import { describe, expect, it } from "vitest";
import {
  attemptItemIdSchema,
  examAttemptIdSchema,
  presetIdSchema,
  saveExamAnswerSchema,
} from "./exam.schemas";

const ID = "cmu2osm6c0000ulv26pke85kq";

describe("presetIdSchema", () => {
  it("accepts hand-set ids that are not cuids", () => {
    expect(presetIdSchema.safeParse("seed-preset-trial").success).toBe(true);
    expect(presetIdSchema.safeParse(ID).success).toBe(true);
  });

  it("rejects empty, blank, oversized and non-string ids", () => {
    for (const value of ["", "   ", "x".repeat(192), 42, null, undefined]) {
      expect(presetIdSchema.safeParse(value).success, String(value)).toBe(false);
    }
  });

  it("trims surrounding whitespace", () => {
    expect(presetIdSchema.parse("  seed-preset-trial ")).toBe("seed-preset-trial");
  });
});

describe("saveExamAnswerSchema", () => {
  it("accepts an option or null (clear)", () => {
    expect(saveExamAnswerSchema.safeParse({ attemptItemId: ID, optionId: ID }).success).toBe(true);
    expect(saveExamAnswerSchema.safeParse({ attemptItemId: ID, optionId: null }).success).toBe(true);
  });

  it("requires optionId to be present and rejects extra fields", () => {
    expect(saveExamAnswerSchema.safeParse({ attemptItemId: ID }).success).toBe(false);
    expect(saveExamAnswerSchema.safeParse({ attemptItemId: ID, optionId: "x" }).success).toBe(false);
    expect(
      saveExamAnswerSchema.safeParse({ attemptItemId: ID, optionId: ID, isCorrect: true }).success,
    ).toBe(false);
  });
});

describe("generated id schemas", () => {
  it("accept cuids only", () => {
    expect(examAttemptIdSchema.safeParse(ID).success).toBe(true);
    expect(attemptItemIdSchema.safeParse(ID).success).toBe(true);
    expect(examAttemptIdSchema.safeParse("seed-preset-trial").success).toBe(false);
  });
});
