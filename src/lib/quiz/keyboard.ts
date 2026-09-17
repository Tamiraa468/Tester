import { DISPLAY_LETTERS } from "./letters";

/**
 * Key handling for the quiz, kept pure so it can be tested without a DOM.
 *
 * Arrow keys MOVE FOCUS ONLY, they never choose an option: in practice mode choosing
 * submits the answer, and an answer must never be submitted by arrowing past it.
 * Choosing is always deliberate — click/tap, Enter/Space on a focused option, or the
 * option's digit.
 *
 * Character shortcuts match on event.code (the physical key), never event.key: on the
 * Mongolian layout the number row does not type digits and letter keys type Cyrillic.
 */
export type FocusMove = "next" | "previous" | "first" | "last";

/**
 * Navigation keys are not characters, so event.key is layout-independent here. Both
 * axes move: the list is vertical, but Left/Right are a common reflex.
 */
export function focusMoveForKey(key: string): FocusMove | null {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return "next";
    case "ArrowUp":
    case "ArrowLeft":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
}

/**
 * Focus stops at the ends instead of wrapping, so holding an arrow key can't cycle
 * the list and lose the user's place. Returns -1 for an empty list.
 */
export function moveFocusIndex(current: number, count: number, move: FocusMove): number {
  if (count <= 0) return -1;
  const last = count - 1;
  const from = Math.min(Math.max(current, 0), last);
  switch (move) {
    case "next":
      return Math.min(from + 1, last);
    case "previous":
      return Math.max(from - 1, 0);
    case "first":
      return 0;
    case "last":
      return last;
  }
}

/** The part of a keyboard event the mapping reads; DOM and React events both fit. */
export type ShortcutKeyEvent = {
  code: string;
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  repeat: boolean;
};

function isActivationCode(code: string): boolean {
  return code === "Enter" || code === "NumpadEnter" || code === "Space";
}

/** Enter or Space on a focused option chooses it, once: auto-repeat never answers. */
export function isChooseKey(event: Pick<ShortcutKeyEvent, "code" | "repeat">): boolean {
  return !event.repeat && isActivationCode(event.code);
}

/**
 * An auto-repeated Enter/Space. Buttons and links activate on every repeat, so the
 * "next question" control cancels these; holding Enter must never skip feedback.
 */
export function isRepeatedActivation(event: Pick<ShortcutKeyEvent, "code" | "repeat">): boolean {
  return event.repeat && isActivationCode(event.code);
}

export type Shortcut =
  /** Display position, 0-based. The caller still checks it against the option count. */
  | { kind: "option"; index: number }
  | { kind: "flag" }
  | { kind: "next" }
  | { kind: "previous" }
  | { kind: "help" };

/**
 * Global quiz shortcuts: Digit1-6 / Numpad1-6 choose, KeyF flags, KeyN / KeyP move to
 * the next / previous question (exam), Shift+Slash or "?" opens the shortcut help. Shift is allowed on digits because the Mongolian
 * layout needs it to type them. Modified and auto-repeated presses are ignored.
 */
export function shortcutFor(event: ShortcutKeyEvent): Shortcut | null {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return null;

  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
  if (digit) {
    const index = Number(digit[1]) - 1;
    return index < DISPLAY_LETTERS.length ? { kind: "option", index } : null;
  }
  if (event.code === "KeyF") return { kind: "flag" };
  if (event.code === "KeyN") return { kind: "next" };
  if (event.code === "KeyP") return { kind: "previous" };
  if ((event.code === "Slash" && event.shiftKey) || event.key === "?") return { kind: "help" };
  return null;
}
