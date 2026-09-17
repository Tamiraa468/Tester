import { DISPLAY_LETTERS } from "./letters";

/**
 * Key handling for the answer list, kept pure so it can be tested without a DOM and
 * so the component itself only has to move focus.
 *
 * Arrow keys MOVE FOCUS ONLY, they never choose an option: in practice mode choosing
 * submits the answer, and an answer must never be submitted by arrowing past it.
 * Choosing is always deliberate — click/tap, Enter/Space, or the option's digit.
 */
export type FocusMove = "next" | "previous" | "first" | "last";

/** Both axes move: the list is vertical, but Left/Right are a common reflex. */
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

/** Enter and Space choose the focused option. */
export function isChooseKey(key: string): boolean {
  return key === "Enter" || key === " ";
}

/**
 * Digits 1..6 map to display positions 1..6 (the a b c d e f of the printed book).
 * Returns null for any other key, and for a digit past the end of this question's
 * options, so a four-option question ignores 5 and 6.
 */
export function optionIndexForDigit(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  if (index >= count || index >= DISPLAY_LETTERS.length) return null;
  return index;
}
