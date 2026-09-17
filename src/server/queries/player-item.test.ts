import { describe, expect, it } from "vitest";
import { canRevealItem, toPlayerItem, type RawPlayerItem } from "./player-item";

const raw = (overrides: Partial<RawPlayerItem> = {}): RawPlayerItem => ({
  id: "item1",
  position: 0,
  optionOrder: ["o3", "o1", "o2"],
  selectedOptionId: null,
  isCorrect: null,
  flagged: false,
  question: {
    id: "q1",
    text: "Асуулт?",
    imageUrl: null,
    explanation: "Тайлбар нь хариултыг илчилнэ.",
    subject: { name: "Статистик" },
    options: [
      { id: "o1", text: "Нэг", isCorrect: false },
      { id: "o2", text: "Хоёр", isCorrect: true },
      { id: "o3", text: "Гурав", isCorrect: false },
    ],
  },
  ...overrides,
});

const practiceOpen = { mode: "PRACTICE", status: "IN_PROGRESS", bookmarked: false } as const;

describe("canRevealItem", () => {
  it("reveals a practice item once it is answered, whatever the attempt status", () => {
    expect(canRevealItem("PRACTICE", "IN_PROGRESS", false)).toBe(false);
    expect(canRevealItem("PRACTICE", "IN_PROGRESS", true)).toBe(true);
    expect(canRevealItem("PRACTICE", "SUBMITTED", false)).toBe(false);
  });

  it("reveals exam items only after the attempt is over", () => {
    expect(canRevealItem("EXAM", "IN_PROGRESS", true)).toBe(false);
    expect(canRevealItem("EXAM", "SUBMITTED", false)).toBe(true);
    expect(canRevealItem("EXAM", "EXPIRED", true)).toBe(true);
  });
});

describe("toPlayerItem", () => {
  it("orders options by optionOrder and uses a 1-based position", () => {
    const item = toPlayerItem(raw({ position: 4 }), practiceOpen);
    expect(item.options.map((option) => option.id)).toEqual(["o3", "o1", "o2"]);
    expect(item.position).toBe(5);
  });

  it("sends no correctness data at all for an unanswered practice item", () => {
    const item = toPlayerItem(raw(), practiceOpen);
    expect(item.result).toBeNull();
    const json = JSON.stringify(item);
    expect(json).not.toContain("isCorrect");
    expect(json).not.toContain("correctOptionId");
    expect(json).not.toContain("explanation");
    expect(json).not.toContain("Тайлбар");
    for (const option of item.options) expect(Object.keys(option).sort()).toEqual(["id", "text"]);
  });

  it("hides correctness of an answered exam item while the exam is running", () => {
    const item = toPlayerItem(
      raw({ selectedOptionId: "o1", isCorrect: false }),
      { mode: "EXAM", status: "IN_PROGRESS", bookmarked: false },
    );
    expect(item.selectedOptionId).toBe("o1");
    expect(item.result).toBeNull();
    expect(JSON.stringify(item)).not.toContain("isCorrect");
  });

  it("restores the stored result of an answered practice item", () => {
    const item = toPlayerItem(raw({ selectedOptionId: "o1", isCorrect: false }), practiceOpen);
    expect(item.result).toEqual({
      isCorrect: false,
      correctOptionId: "o2",
      explanation: "Тайлбар нь хариултыг илчилнэ.",
    });
    const right = toPlayerItem(raw({ selectedOptionId: "o2", isCorrect: true }), practiceOpen);
    expect(right.result?.isCorrect).toBe(true);
  });

  it("reveals every item of a finished exam, counting unanswered as not correct", () => {
    const item = toPlayerItem(raw(), { mode: "EXAM", status: "SUBMITTED", bookmarked: false });
    expect(item.result).toEqual(expect.objectContaining({ isCorrect: false, correctOptionId: "o2" }));
  });

  it("drops an option id that no longer exists instead of rendering a blank", () => {
    const item = toPlayerItem(raw({ optionOrder: ["o3", "gone", "o1", "o2"] }), practiceOpen);
    expect(item.options.map((option) => option.id)).toEqual(["o3", "o1", "o2"]);
  });

  it("passes through bookmark, flag, image and subject", () => {
    const base = raw({ flagged: true });
    const item = toPlayerItem(
      { ...base, question: { ...base.question, imageUrl: "/img/a.png" } },
      { ...practiceOpen, bookmarked: true },
    );
    expect(item).toEqual(
      expect.objectContaining({
        bookmarked: true,
        flagged: true,
        imageUrl: "/img/a.png",
        subjectName: "Статистик",
        questionId: "q1",
        text: "Асуулт?",
      }),
    );
  });

  it("fails loudly when a revealed question has no correct option", () => {
    const base = raw({ selectedOptionId: "o1", isCorrect: false });
    const broken = {
      ...base,
      question: {
        ...base.question,
        options: base.question.options.map((option) => ({ ...option, isCorrect: false })),
      },
    };
    expect(() => toPlayerItem(broken, practiceOpen)).toThrow(/no correct option/);
  });
});
