import { describe, expect, it } from "vitest";
import { subjectBreakdown } from "./exam-result";

describe("subjectBreakdown", () => {
  it("groups by subject, sorts by name and adds up to the total", () => {
    const { rows, total } = subjectBreakdown([
      { subjectName: "Статистик", answered: true, isCorrect: true },
      { subjectName: "Философи", answered: true, isCorrect: false },
      { subjectName: "Статистик", answered: false, isCorrect: false },
      { subjectName: "Статистик", answered: true, isCorrect: true },
      { subjectName: "Философи", answered: true, isCorrect: true },
    ]);
    expect(rows).toEqual([
      { subject: "Статистик", correct: 2, answered: 2, total: 3, percent: 67 },
      { subject: "Философи", correct: 1, answered: 2, total: 2, percent: 50 },
    ]);
    expect(total).toEqual({ subject: "Нийт", correct: 3, answered: 4, total: 5, percent: 60 });
  });

  it("handles an empty attempt without NaN", () => {
    expect(subjectBreakdown([])).toEqual({
      rows: [],
      total: { subject: "Нийт", correct: 0, answered: 0, total: 0, percent: 0 },
    });
  });
});
