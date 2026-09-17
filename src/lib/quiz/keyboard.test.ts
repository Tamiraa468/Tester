import { describe, expect, it } from "vitest";
import {
  focusMoveForKey,
  isChooseKey,
  isRepeatedActivation,
  moveFocusIndex,
  shortcutFor,
  type ShortcutKeyEvent,
} from "./keyboard";

const press = (code: string, key: string, extra: Partial<ShortcutKeyEvent> = {}): ShortcutKeyEvent => ({
  code,
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  repeat: false,
  ...extra,
});

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
  it("accepts Enter, NumpadEnter and Space by code", () => {
    expect(isChooseKey(press("Enter", "Enter"))).toBe(true);
    expect(isChooseKey(press("NumpadEnter", "Enter"))).toBe(true);
    expect(isChooseKey(press("Space", " "))).toBe(true);
  });

  it("ignores auto-repeat so holding the key answers at most once", () => {
    expect(isChooseKey(press("Enter", "Enter", { repeat: true }))).toBe(false);
    expect(isChooseKey(press("Space", " ", { repeat: true }))).toBe(false);
  });

  it("ignores other keys, including a key that merely reports Enter", () => {
    expect(isChooseKey(press("ArrowDown", "ArrowDown"))).toBe(false);
    expect(isChooseKey(press("KeyE", "Enter"))).toBe(false);
  });
});

describe("isRepeatedActivation", () => {
  it("is true only for auto-repeated Enter/Space", () => {
    expect(isRepeatedActivation(press("Enter", "Enter", { repeat: true }))).toBe(true);
    expect(isRepeatedActivation(press("NumpadEnter", "Enter", { repeat: true }))).toBe(true);
    expect(isRepeatedActivation(press("Space", " ", { repeat: true }))).toBe(true);
    expect(isRepeatedActivation(press("Enter", "Enter"))).toBe(false);
    expect(isRepeatedActivation(press("KeyA", "a", { repeat: true }))).toBe(false);
  });
});

describe("shortcutFor", () => {
  it("maps Digit1-6 to display positions on the English layout", () => {
    expect(["1", "2", "3", "4", "5", "6"].map((n) => shortcutFor(press(`Digit${n}`, n)))).toEqual(
      [0, 1, 2, 3, 4, 5].map((index) => ({ kind: "option", index })),
    );
  });

  it("maps the same physical keys on the Mongolian layout, where they type symbols", () => {
    expect(shortcutFor(press("Digit1", "№"))).toEqual({ kind: "option", index: 0 });
    expect(shortcutFor(press("Digit4", "₮"))).toEqual({ kind: "option", index: 3 });
  });

  it("accepts Shift+digit, which is how the Mongolian layout types digits", () => {
    expect(shortcutFor(press("Digit2", "2", { shiftKey: true }))).toEqual({ kind: "option", index: 1 });
  });

  it("maps Numpad1-6", () => {
    expect(shortcutFor(press("Numpad1", "1"))).toEqual({ kind: "option", index: 0 });
    expect(shortcutFor(press("Numpad6", "6"))).toEqual({ kind: "option", index: 5 });
  });

  it("ignores digits past the display letters and zero", () => {
    expect(shortcutFor(press("Digit7", "7"))).toBeNull();
    expect(shortcutFor(press("Numpad9", "9"))).toBeNull();
    expect(shortcutFor(press("Digit0", "0"))).toBeNull();
  });

  it("does not map a digit character typed by some other key", () => {
    // e.g. an AZERTY-style layout: the character is "1" but the key is not Digit1.
    expect(shortcutFor(press("KeyQ", "1"))).toBeNull();
  });

  it("maps KeyF to the flag on both layouts", () => {
    expect(shortcutFor(press("KeyF", "f"))).toEqual({ kind: "flag" });
    expect(shortcutFor(press("KeyF", "а"))).toEqual({ kind: "flag" });
    expect(shortcutFor(press("KeyF", "F", { shiftKey: true }))).toEqual({ kind: "flag" });
  });

  it("does not map a Cyrillic or Latin f typed by another key", () => {
    expect(shortcutFor(press("KeyA", "ф"))).toBeNull();
    expect(shortcutFor(press("KeyA", "f"))).toBeNull();
  });

  it("maps KeyN / KeyP to next / previous on both layouts", () => {
    expect(shortcutFor(press("KeyN", "n"))).toEqual({ kind: "next" });
    expect(shortcutFor(press("KeyN", "т"))).toEqual({ kind: "next" });
    expect(shortcutFor(press("KeyP", "p"))).toEqual({ kind: "previous" });
    expect(shortcutFor(press("KeyP", "з"))).toEqual({ kind: "previous" });
  });

  it("does not map n or p typed by other keys, or held keys", () => {
    expect(shortcutFor(press("KeyY", "n"))).toBeNull();
    expect(shortcutFor(press("KeyZ", "p"))).toBeNull();
    expect(shortcutFor(press("KeyN", "n", { repeat: true }))).toBeNull();
    expect(shortcutFor(press("KeyP", "p", { ctrlKey: true }))).toBeNull();
  });

  it("opens help with Shift+Slash or a typed ?", () => {
    expect(shortcutFor(press("Slash", "?", { shiftKey: true }))).toEqual({ kind: "help" });
    expect(shortcutFor(press("Slash", ".", { shiftKey: true }))).toEqual({ kind: "help" });
    expect(shortcutFor(press("Digit0", "?"))).toEqual({ kind: "help" });
    expect(shortcutFor(press("Slash", "/"))).toBeNull();
  });

  it("leaves Enter to the focused control", () => {
    expect(shortcutFor(press("Enter", "Enter"))).toBeNull();
    expect(shortcutFor(press("NumpadEnter", "Enter"))).toBeNull();
  });

  it("ignores modified and auto-repeated presses", () => {
    expect(shortcutFor(press("Digit1", "1", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("Digit1", "1", { metaKey: true }))).toBeNull();
    expect(shortcutFor(press("KeyF", "f", { altKey: true }))).toBeNull();
    expect(shortcutFor(press("Digit1", "1", { repeat: true }))).toBeNull();
    expect(shortcutFor(press("Slash", "?", { shiftKey: true, repeat: true }))).toBeNull();
  });
});
