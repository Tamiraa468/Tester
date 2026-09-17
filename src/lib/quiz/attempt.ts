// Pure helpers around attempts: which item to show, and where the correct option
// sat last time (so a new attempt can avoid putting it there again).

type AnswerState = { selectedOptionId: string | null };

/** Index of the first unanswered item, or -1 when every item is answered. */
export function firstUnansweredIndex(items: readonly AnswerState[]): number {
  return items.findIndex((item) => item.selectedOptionId === null);
}

/**
 * The player's `?i=` is 1-based, like the "12 / 20" the user sees. A missing, malformed
 * or out-of-range value falls back to the first unanswered item, or to the last item
 * once everything is answered. Returns a 0-based index (0 for an empty list).
 */
export function resolvePlayerIndex(
  raw: string | string[] | undefined,
  items: readonly AnswerState[],
): number {
  if (typeof raw === "string" && /^\d+$/.test(raw)) {
    const position = Number(raw);
    if (position >= 1 && position <= items.length) return position - 1;
  }
  const unanswered = firstUnansweredIndex(items);
  return unanswered >= 0 ? unanswered : Math.max(items.length - 1, 0);
}

/**
 * Keeps the first optionOrder seen per question. Callers pass rows newest first, so
 * this is each question's most recent order.
 */
export function latestOptionOrderByQuestion(
  rows: readonly { questionId: string; optionOrder: readonly string[] }[],
): Map<string, readonly string[]> {
  const latest = new Map<string, readonly string[]>();
  for (const row of rows) {
    if (!latest.has(row.questionId)) latest.set(row.questionId, row.optionOrder);
  }
  return latest;
}

/** Where the correct option was displayed last time; undefined when unknown. */
export function previousCorrectIndex(
  optionOrder: readonly string[] | undefined,
  correctOptionId: string | undefined,
): number | undefined {
  if (!optionOrder || !correctOptionId) return undefined;
  const index = optionOrder.indexOf(correctOptionId);
  return index >= 0 ? index : undefined;
}
