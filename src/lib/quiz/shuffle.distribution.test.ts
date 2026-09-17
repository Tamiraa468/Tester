import { describe, expect, it } from "vitest";
import { cryptoRandomInt } from "./random";
import { buildOptionOrder, type OptionForOrder } from "./shuffle";

// In the printed book the correct answer is always the LAST option, so this is the
// shape that matters: if shuffling were biased, "always pick the last one" would score.
const OPTIONS: OptionForOrder[] = [
  { id: "o1", isCorrect: false, pinned: false, sortOrder: 0 },
  { id: "o2", isCorrect: false, pinned: false, sortOrder: 1 },
  { id: "o3", isCorrect: false, pinned: false, sortOrder: 2 },
  { id: "o4", isCorrect: true, pinned: false, sortOrder: 3 },
];

const RUNS = 24_000;
const EXPECTED = RUNS / OPTIONS.length; // 6000
const TOLERANCE = EXPECTED * 0.05; // +/- 5% => 5700..6300

describe("buildOptionOrder distribution (real crypto generator)", () => {
  it("places every option in every position about equally often", () => {
    const counts = OPTIONS.map(() => new Array<number>(OPTIONS.length).fill(0));
    const indexById = new Map(OPTIONS.map((option, index) => [option.id, index]));

    for (let run = 0; run < RUNS; run += 1) {
      const order = buildOptionOrder(OPTIONS, { lockOptions: false, rand: cryptoRandomInt });
      order.forEach((id, position) => {
        counts[indexById.get(id)!][position] += 1;
      });
    }

    for (const [optionIndex, positions] of counts.entries()) {
      // Every option appears exactly once per run.
      expect(positions.reduce((sum, count) => sum + count, 0)).toBe(RUNS);
      for (const [position, count] of positions.entries()) {
        expect(
          Math.abs(count - EXPECTED),
          `option ${OPTIONS[optionIndex].id} at position ${position}: ${count}`,
        ).toBeLessThanOrEqual(TOLERANCE);
      }
    }
  });
});
