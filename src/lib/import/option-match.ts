// Which existing Option each incoming option row belongs to.
//
// Option ids are stored in AttemptItem.optionOrder, so identity has to follow the TEXT,
// not the column: a spreadsheet whose option columns were reordered must keep each id
// with its text, or an answered attempt would start showing a different option. Rows
// that match no text fall back to the remaining options in sortOrder, which is what a
// straight edit of an option's wording looks like.

import { normalizeText } from "./parse";
import type { OptionInput } from "./types";

export type ExistingOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  pinned: boolean;
  sortOrder: number;
};

export type OptionAssignment = {
  /** The existing option this row keeps, or null when the row is new. */
  existing: ExistingOption | null;
  /** The row's target state; sortOrder is its position in the file. */
  target: OptionInput;
  /** Whether anything about the stored option would actually change. */
  changed: boolean;
};

export type OptionPlan = {
  assignments: OptionAssignment[];
  /** Existing options no row claimed. */
  surplus: ExistingOption[];
};

const key = (text: string) => normalizeText(text).toLowerCase();

function isChanged(existing: ExistingOption, target: OptionInput): boolean {
  return (
    existing.text !== target.text ||
    existing.isCorrect !== target.isCorrect ||
    existing.pinned !== target.pinned ||
    existing.sortOrder !== target.sortOrder
  );
}

export function planOptions(
  existing: readonly ExistingOption[],
  incoming: readonly OptionInput[],
): OptionPlan {
  const available = [...existing].sort((a, b) => a.sortOrder - b.sortOrder);
  const claimed = new Set<string>();

  // Pass 1: exact text (normalized, case-insensitive). Duplicated texts are claimed in
  // sortOrder order, so two identical options stay distinct rows.
  const byText = new Map<string, ExistingOption[]>();
  for (const option of available) {
    const bucket = byText.get(key(option.text));
    if (bucket) bucket.push(option);
    else byText.set(key(option.text), [option]);
  }

  const matched: (ExistingOption | null)[] = incoming.map((row) => {
    const bucket = byText.get(key(row.text));
    const found = bucket?.shift();
    if (!found) return null;
    claimed.add(found.id);
    return found;
  });

  // Pass 2: whatever is left, in sortOrder, for rows whose text was edited.
  const leftovers = available.filter((option) => !claimed.has(option.id));
  for (let index = 0; index < matched.length; index += 1) {
    if (matched[index] !== null) continue;
    const next = leftovers.shift();
    if (!next) break;
    claimed.add(next.id);
    matched[index] = next;
  }

  return {
    assignments: incoming.map((row, index) => {
      const target: OptionInput = { ...row, sortOrder: index };
      const found = matched[index] ?? null;
      return { existing: found, target, changed: found === null || isChanged(found, target) };
    }),
    surplus: available.filter((option) => !claimed.has(option.id)),
  };
}
