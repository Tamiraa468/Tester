import { describe, expect, it } from "vitest";
import {
  focusMoveForKey,
  isChooseKey,
  moveFocusIndex,
  optionIndexForDigit,
} from "./keyboard";

describe("focusMoveForKey", () => {
  it("maps both axes to the same moves", () => {
    expect(focusMoveForKey("ArrowDown")).toBe("next");
    expect(focusMoveForKey("ArrowRight")).toBe("next");
    expect(focusMoveForKey("ArrowUp")).toBe("previous");
    expect(focusMoveForKey("ArrowLeft")).toBe("previous");
    expect(focusMoveForKey("Home")).toBe("first");
    expect(focusMoveForKey("End")).toBe("last");
  });

  it("ignores the keys that choose an option, so arrows never answer", () => {
    expect(focusMoveForKey("Enter")).toBeNull();
    expect(focusMoveForKey(" ")).toBeNull();
    expect(focusMoveForKey("1")).toBeNull();
    expect(focusMoveForKey("Tab")).toBeNull();
  });
});

describe("moveFocusIndex", () => {
  it("steps one option at a time", () => {
    expect(moveFocusIndex(0, 4, "next")).toBe(1);
    expect(moveFocusIndex(2, 4, "previous")).toBe(1);
  });

  it("stops at the ends instead of wrapping", () => {
    expect(moveFocusIndex(3, 4, "next")).toBe(3);
    expect(moveFocusIndex(0, 4, "previous")).toBe(0);
  });

  it("jumps to the first and last option", () => {
    expect(moveFocusIndex(2, 4, "first")).toBe(0);
    expect(moveFocusIndex(2, 4, "last")).toBe(3);
  });

  it("clamps a current index that is out of range", () => {
    expect(moveFocusIndex(-1, 4, "next")).toBe(1);
    expect(moveFocusIndex(99, 4, "previous")).toBe(2);
  });

  it("returns -1 for an empty list", () => {
    expect(moveFocusIndex(0, 0, "next")).toBe(-1);
    expect(moveFocusIndex(0, 0, "last")).toBe(-1);
  });
});

describe("isChooseKey", () => {
  it("is Enter and Space only", () => {
    expect(isChooseKey("Enter")).toBe(true);
    expect(isChooseKey(" ")).toBe(true);
    expect(isChooseKey("ArrowDown")).toBe(false);
    expect(isChooseKey("Spacebar")).toBe(false);
  });
});

describe("optionIndexForDigit", () => {
  it("maps 1..6 to display positions", () => {
    expect(["1", "2", "3", "4", "5", "6"].map((key) => optionIndexForDigit(key, 6))).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it("ignores a digit past this question's options", () => {
    expect(optionIndexForDigit("5", 4)).toBeNull();
    expect(optionIndexForDigit("4", 4)).toBe(3);
  });

  it("ignores digits past the display letters even when more options exist", () => {
    expect(optionIndexForDigit("7", 9)).toBeNull();
  });

  it("ignores 0 and non-digit keys", () => {
    expect(optionIndexForDigit("0", 4)).toBeNull();
    expect(optionIndexForDigit("a", 4)).toBeNull();
    expect(optionIndexForDigit("Enter", 4)).toBeNull();
  });
});
