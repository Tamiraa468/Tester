import { describe, expect, it } from "vitest";
import { DISPLAY_LETTERS, letterFor } from "./letters";

describe("DISPLAY_LETTERS", () => {
  it("is the Latin sequence used in the printed book", () => {
    expect([...DISPLAY_LETTERS]).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
});

describe("letterFor", () => {
  it("maps a display position to its letter", () => {
    expect([0, 1, 2, 3, 4, 5].map(letterFor)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("throws for a position outside the range", () => {
    expect(() => letterFor(-1)).toThrow(RangeError);
    expect(() => letterFor(6)).toThrow(RangeError);
  });

  it("throws for a non-integer position", () => {
    expect(() => letterFor(1.5)).toThrow(RangeError);
  });
});
