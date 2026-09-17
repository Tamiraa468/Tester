import { describe, expect, it } from "vitest";
import { planOptions, type ExistingOption } from "./option-match";
import type { OptionInput } from "./types";

const existing = (
  id: string,
  text: string,
  sortOrder: number,
  extra: Partial<ExistingOption> = {},
): ExistingOption => ({ id, text, isCorrect: false, pinned: false, sortOrder, ...extra });

const incoming = (text: string, sortOrder: number, extra: Partial<OptionInput> = {}): OptionInput => ({
  text,
  isCorrect: false,
  pinned: false,
  sortOrder,
  ...extra,
});

describe("planOptions", () => {
  it("keeps each id with its text when the columns are reordered", () => {
    const before = [existing("o1", "Нэг", 0), existing("o2", "Хоёр", 1, { isCorrect: true }), existing("o3", "Гурав", 2)];
    // The spreadsheet now lists them in a different order.
    const plan = planOptions(before, [
      incoming("Гурав", 0),
      incoming("Нэг", 1),
      incoming("Хоёр", 2, { isCorrect: true }),
    ]);

    expect(plan.assignments.map((a) => [a.existing?.id, a.target.text, a.target.sortOrder])).toEqual([
      ["o3", "Гурав", 0],
      ["o1", "Нэг", 1],
      ["o2", "Хоёр", 2],
    ]);
    expect(plan.surplus).toEqual([]);
    // Only their positions moved, so every one of them is a change.
    expect(plan.assignments.every((a) => a.changed)).toBe(true);
  });

  it("reports no change when the file matches the database", () => {
    const before = [existing("o1", "Нэг", 0), existing("o2", "Хоёр", 1, { isCorrect: true })];
    const plan = planOptions(before, [incoming("Нэг", 0), incoming("Хоёр", 1, { isCorrect: true })]);
    expect(plan.assignments.map((a) => a.changed)).toEqual([false, false]);
    expect(plan.surplus).toEqual([]);
  });

  it("matches ignoring case and surrounding whitespace", () => {
    const before = [existing("o1", "Нэг", 0), existing("o2", "Хоёр", 1)];
    const plan = planOptions(before, [incoming("  нэг  ", 0), incoming("ХОЁР", 1)]);
    expect(plan.assignments.map((a) => a.existing?.id)).toEqual(["o1", "o2"]);
    // The stored text follows the file, so the wording is updated in place.
    expect(plan.assignments[0].changed).toBe(true);
  });

  it("falls back to sortOrder for a row whose text was edited", () => {
    const before = [existing("o1", "Нэг", 0), existing("o2", "Хоёр", 1), existing("o3", "Гурав", 2)];
    const plan = planOptions(before, [
      incoming("Нэг", 0),
      incoming("Хоёр (зассан)", 1),
      incoming("Гурав", 2),
    ]);
    // "Нэг" and "Гурав" matched by text; the edited one takes the only option left.
    expect(plan.assignments.map((a) => a.existing?.id)).toEqual(["o1", "o2", "o3"]);
    expect(plan.surplus).toEqual([]);
  });

  it("creates rows beyond what exists and reports the surplus", () => {
    const before = [existing("o1", "Нэг", 0), existing("o2", "Хоёр", 1)];
    const grown = planOptions(before, [incoming("Нэг", 0), incoming("Хоёр", 1), incoming("Гурав", 2)]);
    expect(grown.assignments.map((a) => a.existing?.id ?? null)).toEqual(["o1", "o2", null]);

    const shrunk = planOptions(before, [incoming("Хоёр", 0)]);
    expect(shrunk.assignments.map((a) => a.existing?.id)).toEqual(["o2"]);
    expect(shrunk.surplus.map((option) => option.id)).toEqual(["o1"]);
  });

  it("keeps duplicated texts as separate rows", () => {
    const before = [existing("o1", "Тийм", 0), existing("o2", "Тийм", 1), existing("o3", "Үгүй", 2)];
    const plan = planOptions(before, [incoming("Тийм", 0), incoming("Тийм", 1), incoming("Үгүй", 2)]);
    expect(plan.assignments.map((a) => a.existing?.id)).toEqual(["o1", "o2", "o3"]);
  });

  it("follows the answer key onto whichever option now holds it", () => {
    const before = [existing("o1", "Нэг", 0, { isCorrect: true }), existing("o2", "Хоёр", 1)];
    const plan = planOptions(before, [incoming("Нэг", 0), incoming("Хоёр", 1, { isCorrect: true })]);
    expect(plan.assignments[0]).toMatchObject({ changed: true });
    expect(plan.assignments.find((a) => a.target.isCorrect)!.existing!.id).toBe("o2");
  });
});
