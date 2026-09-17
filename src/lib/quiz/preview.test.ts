import { describe, expect, it } from "vitest";
import { buildPreviewOrders, PREVIEW_SHUFFLES } from "./preview";

const rotating = () => {
  let calls = 0;
  // Deterministic stand-in for the crypto generator: cycles through the range.
  return (maxExclusive: number) => (calls++) % maxExclusive;
};

const draft = (flags: { isCorrect?: boolean; pinned?: boolean }[]) =>
  flags.map((flag) => ({ isCorrect: flag.isCorrect ?? false, pinned: flag.pinned ?? false }));

describe("buildPreviewOrders", () => {
  it("returns three complete orders by default", () => {
    const orders = buildPreviewOrders(draft([{ isCorrect: true }, {}, {}, {}]), false, rotating());
    expect(orders).toHaveLength(PREVIEW_SHUFFLES);
    for (const order of orders) {
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
    }
  });

  it("keeps a pinned option last in every order", () => {
    const options = draft([{}, {}, {}, { isCorrect: true, pinned: true }]);
    for (const order of buildPreviewOrders(options, false, rotating())) {
      expect(order.at(-1)).toBe(3);
    }
  });

  it("keeps the original order when the options are locked", () => {
    const options = draft([{}, { isCorrect: true }, {}, {}]);
    for (const order of buildPreviewOrders(options, true, rotating())) {
      expect(order).toEqual([0, 1, 2, 3]);
    }
  });

  it("handles the smallest draft", () => {
    const orders = buildPreviewOrders(draft([{ isCorrect: true }, {}]), false, rotating(), 1);
    expect(orders[0].sort()).toEqual([0, 1]);
  });
});
