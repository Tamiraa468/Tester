import { describe, expect, it } from "vitest";
import { isCorrectAnswer, scoreItems } from "./grading";

const OPTIONS = [
  { id: "o1", isCorrect: false },
  { id: "o2", isCorrect: true },
  { id: "o3", isCorrect: false },
];

describe("isCorrectAnswer", () => {
  it("accepts the correct option id", () => {
    expect(isCorrectAnswer("o2", OPTIONS)).toBe(true);
  });

  it("rejects a wrong or unknown option id", () => {
    expect(isCorrectAnswer("o1", OPTIONS)).toBe(false);
    expect(isCorrectAnswer("does-not-exist", OPTIONS)).toBe(false);
  });

  it("treats an unanswered item as not correct", () => {
    expect(isCorrectAnswer(null, OPTIONS)).toBe(false);
    expect(isCorrectAnswer(undefined, OPTIONS)).toBe(false);
  });
});

describe("scoreItems", () => {
  it("reports nothing answered", () => {
    const items = [
      { selectedOptionId: null, isCorrect: null },
      { selectedOptionId: null, isCorrect: null },
      { selectedOptionId: null, isCorrect: null },
    ];
    expect(scoreItems(items)).toEqual({ correct: 0, answered: 0, total: 3, percent: 0 });
  });

  it("reports a perfect score", () => {
    const items = [
      { selectedOptionId: "a", isCorrect: true },
      { selectedOptionId: "b", isCorrect: true },
    ];
    expect(scoreItems(items)).toEqual({ correct: 2, answered: 2, total: 2, percent: 100 });
  });

  it("rounds a partial score", () => {
    const items = [
      { selectedOptionId: "a", isCorrect: true },
      { selectedOptionId: "b", isCorrect: false },
      { selectedOptionId: "c", isCorrect: false },
    ];
    expect(scoreItems(items)).toEqual({ correct: 1, answered: 3, total: 3, percent: 33 });
  });

  it("counts unanswered items in the total, so percent is over total", () => {
    const items = [
      { selectedOptionId: "a", isCorrect: true },
      { selectedOptionId: null, isCorrect: null },
    ];
    expect(scoreItems(items)).toEqual({ correct: 1, answered: 1, total: 2, percent: 50 });
  });

  it("returns zeros for an empty attempt instead of NaN", () => {
    expect(scoreItems([])).toEqual({ correct: 0, answered: 0, total: 0, percent: 0 });
  });

  it("tolerates items with the fields omitted entirely", () => {
    expect(scoreItems([{}, {}])).toEqual({ correct: 0, answered: 0, total: 2, percent: 0 });
  });
});
