/**
 * Display letters, Latin as in the printed book. They are derived from the display
 * position and never stored: the stored order lives in AttemptItem.optionOrder.
 */
export const DISPLAY_LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

export function letterFor(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= DISPLAY_LETTERS.length) {
    // Fail loudly: a bad index would otherwise render as a blank label.
    throw new RangeError(`Display position out of range: ${index}`);
  }
  return DISPLAY_LETTERS[index];
}
