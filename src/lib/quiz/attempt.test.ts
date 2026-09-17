import { describe, expect, it } from "vitest";
import {
  firstUnansweredIndex,
  latestOptionOrderByQuestion,
  previousCorrectIndex,
  resolvePlayerIndex,
} from "./attempt";

const answered = { selectedOptionId: "o1" };
const open = { selectedOptionId: null };

describe("firstUnansweredIndex", () => {
  it("finds the first unanswered item", () => {
    expect(firstUnansweredIndex([answered, open, open])).toBe(1);
  });

  it("returns -1 when everything is answered or the list is empty", () => {
    expect(firstUnansweredIndex([answered, answered])).toBe(-1);
    expect(firstUnansweredIndex([])).toBe(-1);
  });
});

describe("resolvePlayerIndex", () => {
  const items = [answered, open, open];

  it("reads a 1-based position", () => {
    expect(resolvePlayerIndex("1", items)).toBe(0);
    expect(resolvePlayerIndex("3", items)).toBe(2);
  });

  it("falls back to the first unanswered item for bad input", () => {
    for (const raw of [undefined, "", "0", "4", "-1", "1.5", "abc", " 2", ["2"]]) {
      expect(resolvePlayerIndex(raw, items), String(raw)).toBe(1);
    }
  });

  it("falls back to the last item when everything is answered", () => {
    expect(resolvePlayerIndex(undefined, [answered, answered])).toBe(1);
  });

  it("returns 0 for an empty attempt", () => {
    expect(resolvePlayerIndex("1", [])).toBe(0);
  });
});

describe("latestOptionOrderByQuestion", () => {
  it("keeps the first (newest) order per question", () => {
    const latest = latestOptionOrderByQuestion([
      { questionId: "q1", optionOrder: ["b", "a"] },
      { questionId: "q2", optionOrder: ["x", "y"] },
      { questionId: "q1", optionOrder: ["a", "b"] },
    ]);
    expect(latest.get("q1")).toEqual(["b", "a"]);
    expect(latest.get("q2")).toEqual(["x", "y"]);
    expect(latest.size).toBe(2);
  });
});

describe("previousCorrectIndex", () => {
  it("finds where the correct option was shown", () => {
    expect(previousCorrectIndex(["b", "c", "a"], "a")).toBe(2);
  });

  it("is undefined when there is no previous order or the option is not in it", () => {
    expect(previousCorrectIndex(undefined, "a")).toBeUndefined();
    expect(previousCorrectIndex(["b", "c"], "a")).toBeUndefined();
    expect(previousCorrectIndex(["b", "c"], undefined)).toBeUndefined();
  });
});
