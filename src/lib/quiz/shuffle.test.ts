import { describe, expect, it } from "vitest";
import type { RandomInt } from "./random";
import { buildOptionOrder, buildQuestionOrder, shuffled, type OptionForOrder } from "./shuffle";

/** Deterministic generator (mulberry32) so shuffles are reproducible in tests. */
function seededRandomInt(seed: number): RandomInt {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(unit * maxExclusive);
  };
}

/** Returns the scripted values in order, and counts how many times it was called. */
function scriptedRandomInt(values: number[]): RandomInt & { calls: () => number } {
  let index = 0;
  return Object.assign(
    () => {
      const value = values[index] ?? 0;
      index += 1;
      return value;
    },
    { calls: () => index },
  );
}

/** Always returns the same value, so a shuffle outcome is fully predictable. */
function countingRandomInt(value: number): RandomInt & { calls: () => number } {
  let callCount = 0;
  return Object.assign(
    () => {
      callCount += 1;
      return value;
    },
    { calls: () => callCount },
  );
}

// Four options in book order: the correct one is last.
const OPTIONS: OptionForOrder[] = [
  { id: "o1", isCorrect: false, pinned: false, sortOrder: 0 },
  { id: "o2", isCorrect: false, pinned: false, sortOrder: 1 },
  { id: "o3", isCorrect: false, pinned: false, sortOrder: 2 },
  { id: "o4", isCorrect: true, pinned: false, sortOrder: 3 },
];

// o2 and o4 are pinned ("Бүгд зөв" style); o4 is also the correct one.
const WITH_PINNED: OptionForOrder[] = [
  { id: "o1", isCorrect: false, pinned: false, sortOrder: 0 },
  { id: "o2", isCorrect: false, pinned: true, sortOrder: 1 },
  { id: "o3", isCorrect: false, pinned: false, sortOrder: 2 },
  { id: "o4", isCorrect: true, pinned: true, sortOrder: 3 },
];

const ids = (options: OptionForOrder[]) => options.map((option) => option.id);
const sorted = (values: string[]) => [...values].sort();

describe("shuffled", () => {
  it("returns a permutation without mutating the input", () => {
    const items = ["a", "b", "c", "d", "e"];
    const snapshot = [...items];
    const result = shuffled(items, seededRandomInt(1));
    expect(sorted(result)).toEqual(sorted(items));
    expect(items).toEqual(snapshot);
  });

  it("is deterministic for a given seed", () => {
    const first = shuffled([1, 2, 3, 4, 5, 6], seededRandomInt(42));
    const second = shuffled([1, 2, 3, 4, 5, 6], seededRandomInt(42));
    expect(first).toEqual(second);
  });

  it("handles empty and single-element input", () => {
    expect(shuffled([], seededRandomInt(1))).toEqual([]);
    expect(shuffled(["only"], seededRandomInt(1))).toEqual(["only"]);
  });

  it("consults the generator once per element beyond the first", () => {
    const rand = countingRandomInt(0);
    shuffled(["a", "b", "c", "d"], rand);
    expect(rand.calls()).toBe(3);
  });
});

describe("buildOptionOrder", () => {
  it("always returns a permutation of the input ids", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const order = buildOptionOrder(OPTIONS, { lockOptions: false, rand: seededRandomInt(seed) });
      expect(order).toHaveLength(OPTIONS.length);
      expect(sorted(order)).toEqual(sorted(ids(OPTIONS)));
    }
  });

  it("keeps the original sortOrder when lockOptions is set, pinned options included", () => {
    const order = buildOptionOrder(WITH_PINNED, {
      lockOptions: true,
      rand: seededRandomInt(7),
    });
    expect(order).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("never consults the generator when lockOptions is set", () => {
    const rand = countingRandomInt(0);
    buildOptionOrder(OPTIONS, { lockOptions: true, rand });
    expect(rand.calls()).toBe(0);
  });

  it("orders by sortOrder even when the input array is scrambled", () => {
    const scrambled = [...WITH_PINNED].reverse();
    const order = buildOptionOrder(scrambled, { lockOptions: true, rand: seededRandomInt(3) });
    expect(order).toEqual(["o1", "o2", "o3", "o4"]);
  });

  it("puts pinned options last, in their original sortOrder", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const order = buildOptionOrder(WITH_PINNED, {
        lockOptions: false,
        rand: seededRandomInt(seed),
      });
      expect(order.slice(2)).toEqual(["o2", "o4"]);
      expect(sorted(order.slice(0, 2))).toEqual(["o1", "o3"]);
    }
  });

  it("reshuffles when the correct option lands on previousCorrectIndex", () => {
    // All-zero shuffle puts the correct option at index 2; the next scripted attempt
    // ([3, 0, 0]) moves it to index 3.
    const rand = scriptedRandomInt([0, 0, 0, 3, 0, 0]);
    const order = buildOptionOrder(OPTIONS, {
      lockOptions: false,
      previousCorrectIndex: 2,
      rand,
    });
    expect(order).toEqual(["o2", "o3", "o1", "o4"]);
    expect(order.indexOf("o4")).not.toBe(2);
    expect(rand.calls()).toBe(6);
  });

  it("gives up after maxRetries instead of looping forever", () => {
    // This generator always lands the correct option on index 2.
    const rand = countingRandomInt(0);
    const order = buildOptionOrder(OPTIONS, {
      lockOptions: false,
      previousCorrectIndex: 2,
      rand,
      maxRetries: 3,
    });
    expect(sorted(order)).toEqual(sorted(ids(OPTIONS)));
    expect(order.indexOf("o4")).toBe(2);
    // 1 initial attempt + 3 retries, 3 generator calls each.
    expect(rand.calls()).toBe(12);
  });

  it("skips the previousCorrectIndex rule when the correct option is pinned", () => {
    const rand = countingRandomInt(0);
    const order = buildOptionOrder(WITH_PINNED, {
      lockOptions: false,
      previousCorrectIndex: 3,
      rand,
    });
    expect(order).toEqual(["o3", "o1", "o2", "o4"]);
    // One attempt over the two non-pinned options only: no retries.
    expect(rand.calls()).toBe(1);
  });

  it("skips the previousCorrectIndex rule with fewer than two non-pinned options", () => {
    const rand = countingRandomInt(0);
    const order = buildOptionOrder(
      [
        { id: "o1", isCorrect: true, pinned: false, sortOrder: 0 },
        { id: "o2", isCorrect: false, pinned: true, sortOrder: 1 },
      ],
      { lockOptions: false, previousCorrectIndex: 0, rand },
    );
    expect(order).toEqual(["o1", "o2"]);
    expect(rand.calls()).toBe(0);
  });

  it("handles a question with no correct option flagged", () => {
    const order = buildOptionOrder(
      OPTIONS.map((option) => ({ ...option, isCorrect: false })),
      { lockOptions: false, previousCorrectIndex: 0, rand: seededRandomInt(5) },
    );
    expect(sorted(order)).toEqual(sorted(ids(OPTIONS)));
  });
});

describe("buildQuestionOrder", () => {
  it("returns a permutation of the question ids", () => {
    const questionIds = ["q1", "q2", "q3", "q4", "q5"];
    const order = buildQuestionOrder(questionIds, seededRandomInt(9));
    expect(sorted(order)).toEqual(sorted(questionIds));
  });
});
