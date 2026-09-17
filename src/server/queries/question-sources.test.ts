import { describe, expect, it } from "vitest";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import { MASTERED_BOX } from "@/lib/quiz/leitner";
import {
  canRetryFrom,
  COUNTED_SOURCES,
  incorrectItemsWhere,
  MAX_CUSTOM_QUESTIONS,
  progressOrderForSource,
  questionWhereForSource,
} from "./question-sources";

const NOW = new Date("2026-09-17T08:00:00.000Z");
const base = { userId: "u1", now: NOW };

describe("questionWhereForSource", () => {
  it("limits every source to active questions", () => {
    for (const source of COUNTED_SOURCES) {
      const where = questionWhereForSource({ ...base, source });
      expect(where.AND, source).toContainEqual({ isActive: true });
    }
    const custom = questionWhereForSource({ ...base, source: AttemptSource.CUSTOM, questionIds: ["q1"] });
    expect(custom.AND).toContainEqual({ isActive: true });
  });

  it("applies the subject filter to every source", () => {
    for (const source of COUNTED_SOURCES) {
      const where = questionWhereForSource({ ...base, subjectId: "s1", source });
      expect(where.AND, source).toContainEqual({ isActive: true, subjectId: "s1" });
    }
    const custom = questionWhereForSource({
      ...base,
      subjectId: "s1",
      source: AttemptSource.CUSTOM,
      questionIds: ["q1"],
    });
    expect(custom.AND).toContainEqual({ isActive: true, subjectId: "s1" });
  });

  it("ignores an empty or null subject", () => {
    expect(questionWhereForSource({ ...base, subjectId: "", source: "RANDOM" }).AND).toContainEqual({
      isActive: true,
    });
    expect(questionWhereForSource({ ...base, subjectId: null, source: "RANDOM" }).AND).toContainEqual({
      isActive: true,
    });
  });

  it("NEW means no progress row for this user", () => {
    expect(questionWhereForSource({ ...base, source: "NEW" }).AND).toContainEqual({
      progress: { none: { userId: "u1" } },
    });
  });

  it("WRONG means answered wrong at least once and not yet mastered", () => {
    expect(questionWhereForSource({ ...base, source: "WRONG" }).AND).toContainEqual({
      progress: {
        some: { userId: "u1", wrongCount: { gt: 0 }, box: { lt: MASTERED_BOX } },
      },
    });
  });

  it("DUE compares against the given now", () => {
    expect(questionWhereForSource({ ...base, source: "DUE" }).AND).toContainEqual({
      progress: { some: { userId: "u1", nextReviewAt: { lte: NOW } } },
    });
  });

  it("RANDOM adds no condition and BOOKMARKED uses the user's bookmarks", () => {
    expect(questionWhereForSource({ ...base, source: "RANDOM" }).AND).toContainEqual({});
    expect(questionWhereForSource({ ...base, source: "BOOKMARKED" }).AND).toContainEqual({
      bookmarks: { some: { userId: "u1" } },
    });
  });

  it("CUSTOM uses the resolved ids, capped", () => {
    const ids = Array.from({ length: MAX_CUSTOM_QUESTIONS + 20 }, (_, index) => `q${index}`);
    const where = questionWhereForSource({ ...base, source: "CUSTOM", questionIds: ids });
    expect(where.AND).toContainEqual({ id: { in: ids.slice(0, MAX_CUSTOM_QUESTIONS) } });
  });

  it("CUSTOM with no ids matches nothing rather than everything", () => {
    expect(questionWhereForSource({ ...base, source: "CUSTOM", questionIds: [] }).AND).toContainEqual({
      id: { in: [] },
    });
  });
});

describe("progressOrderForSource", () => {
  it("orders DUE by the most overdue first", () => {
    expect(progressOrderForSource("DUE")).toEqual([{ nextReviewAt: "asc" }]);
  });

  it("orders WRONG by the lowest box first", () => {
    expect(progressOrderForSource("WRONG")).toEqual([
      { box: "asc" },
      { nextReviewAt: { sort: "asc", nulls: "last" } },
    ]);
  });

  it("leaves the other sources to a full shuffle", () => {
    for (const source of ["NEW", "RANDOM", "BOOKMARKED", "CUSTOM"] as const) {
      expect(progressOrderForSource(source), source).toBeNull();
    }
  });
});

describe("canRetryFrom", () => {
  it("allows a practice attempt in any state", () => {
    for (const status of Object.values(AttemptStatus)) {
      expect(canRetryFrom(AttemptMode.PRACTICE, status), status).toBe(true);
    }
  });

  it("allows an exam only once its results are out", () => {
    expect(canRetryFrom(AttemptMode.EXAM, AttemptStatus.IN_PROGRESS)).toBe(false);
    expect(canRetryFrom(AttemptMode.EXAM, AttemptStatus.SUBMITTED)).toBe(true);
    expect(canRetryFrom(AttemptMode.EXAM, AttemptStatus.EXPIRED)).toBe(true);
  });
});

describe("incorrectItemsWhere", () => {
  it("takes wrong answers from a practice attempt", () => {
    expect(incorrectItemsWhere(AttemptMode.PRACTICE)).toEqual({ isCorrect: false });
  });

  it("counts unanswered and ungraded exam items as incorrect", () => {
    expect(incorrectItemsWhere(AttemptMode.EXAM)).toEqual({
      OR: [{ selectedOptionId: null }, { isCorrect: false }, { isCorrect: null }],
    });
  });
});
