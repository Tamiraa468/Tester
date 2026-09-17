import { describe, expect, it } from "vitest";
import {
  attemptIdSchema,
  createPracticeAttemptSchema,
  firstErrorMessage,
  PRACTICE_MESSAGES,
  reportQuestionSchema,
  setBookmarkSchema,
  submitPracticeAnswerSchema,
} from "./practice.schemas";

const ID = "cmu2osm6c0000ulv26pke85kq";
const ID2 = "cmu2osm720001ulv2cbmnhju3";

const messageOf = (result: { success: boolean; error?: unknown }) =>
  result.success ? null : firstErrorMessage(result.error as never);

describe("createPracticeAttemptSchema", () => {
  it("accepts every counted source with an allowed count", () => {
    for (const source of ["NEW", "WRONG", "DUE", "RANDOM", "BOOKMARKED"]) {
      for (const count of [10, 20, 50]) {
        expect(createPracticeAttemptSchema.safeParse({ source, count }).success, `${source} ${count}`).toBe(true);
      }
    }
  });

  it("accepts an optional or null subject id", () => {
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: 10, subjectId: ID }).success).toBe(true);
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: 10, subjectId: null }).success).toBe(true);
  });

  it("rejects other counts, a missing count and a malformed subject id", () => {
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: 15 }).success).toBe(false);
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: "10" }).success).toBe(false);
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW" }).success).toBe(false);
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: 10, subjectId: "x y" }).success).toBe(false);
  });

  it("accepts a retry with only fromAttemptId", () => {
    expect(createPracticeAttemptSchema.safeParse({ source: "CUSTOM", fromAttemptId: ID }).success).toBe(true);
  });

  it("never accepts question ids or a count from the client for a retry", () => {
    expect(createPracticeAttemptSchema.safeParse({ source: "CUSTOM" }).success).toBe(false);
    expect(
      createPracticeAttemptSchema.safeParse({ source: "CUSTOM", fromAttemptId: ID, questionIds: [ID2] }).success,
    ).toBe(false);
    expect(
      createPracticeAttemptSchema.safeParse({ source: "CUSTOM", fromAttemptId: ID, count: 10 }).success,
    ).toBe(false);
    expect(createPracticeAttemptSchema.safeParse({ source: "NEW", count: 10, questionIds: [ID] }).success).toBe(false);
  });

  it("rejects an unknown source with a Mongolian message", () => {
    const result = createPracticeAttemptSchema.safeParse({ source: "ALL", count: 10 });
    expect(messageOf(result)).toBe(PRACTICE_MESSAGES.invalid);
  });

  it("rejects a hand-set id that is not a cuid", () => {
    expect(createPracticeAttemptSchema.safeParse({ source: "CUSTOM", fromAttemptId: "seed-preset-trial" }).success).toBe(false);
  });
});

describe("submitPracticeAnswerSchema", () => {
  it("requires two generated ids and nothing else", () => {
    expect(submitPracticeAnswerSchema.safeParse({ attemptItemId: ID, optionId: ID2 }).success).toBe(true);
    expect(submitPracticeAnswerSchema.safeParse({ attemptItemId: ID }).success).toBe(false);
    expect(submitPracticeAnswerSchema.safeParse({ attemptItemId: ID, optionId: "" }).success).toBe(false);
    expect(
      submitPracticeAnswerSchema.safeParse({ attemptItemId: ID, optionId: ID2, isCorrect: true }).success,
    ).toBe(false);
  });
});

describe("attemptIdSchema", () => {
  it("accepts a cuid and rejects anything else", () => {
    expect(attemptIdSchema.safeParse(ID).success).toBe(true);
    expect(attemptIdSchema.safeParse("").success).toBe(false);
    expect(attemptIdSchema.safeParse(42).success).toBe(false);
  });
});

describe("reportQuestionSchema", () => {
  it("trims the message and accepts 5 to 1000 characters", () => {
    const result = reportQuestionSchema.safeParse({ questionId: ID, message: "  Алдаа  " });
    expect(result.success && result.data.message).toBe("Алдаа");
    expect(reportQuestionSchema.safeParse({ questionId: ID, message: "а".repeat(1000) }).success).toBe(true);
  });

  it("explains a message that is too short, counting after trimming", () => {
    const result = reportQuestionSchema.safeParse({ questionId: ID, message: "  абв   " });
    expect(messageOf(result)).toBe(PRACTICE_MESSAGES.reportTooShort);
  });

  it("explains a message that is too long", () => {
    const result = reportQuestionSchema.safeParse({ questionId: ID, message: "а".repeat(1001) });
    expect(messageOf(result)).toBe(PRACTICE_MESSAGES.reportTooLong);
  });

  it("rejects a non-string message with the generic message", () => {
    expect(messageOf(reportQuestionSchema.safeParse({ questionId: ID, message: 12345 }))).toBe(
      PRACTICE_MESSAGES.invalid,
    );
  });
});

describe("an unexpected key", () => {
  // All user-facing text is Mongolian, and an action returns its first issue straight
  // to the UI, so Zod's own English "Unrecognized key" must never get out.
  it("is refused in Mongolian by every schema", () => {
    const cases: [string, { safeParse: (value: unknown) => { success: boolean; error?: unknown } }, object][] = [
      ["createPracticeAttempt", createPracticeAttemptSchema, { source: "RANDOM", count: 10 }],
      ["createPracticeAttempt retry", createPracticeAttemptSchema, { source: "CUSTOM", fromAttemptId: ID }],
      ["submitPracticeAnswer", submitPracticeAnswerSchema, { attemptItemId: ID, optionId: ID2 }],
      ["setBookmark", setBookmarkSchema, { questionId: ID, bookmarked: true }],
      ["reportQuestion", reportQuestionSchema, { questionId: ID, message: "Алдаа байна" }],
    ];

    for (const [name, schema, valid] of cases) {
      expect(schema.safeParse(valid).success, name).toBe(true);
      const result = schema.safeParse({ ...valid, unexpected: 1 });
      expect(messageOf(result), name).toBe(PRACTICE_MESSAGES.invalid);
    }
  });
});
