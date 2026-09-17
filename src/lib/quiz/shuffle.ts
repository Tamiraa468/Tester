import type { RandomInt } from "./random";

export type OptionForOrder = {
  id: string;
  isCorrect: boolean;
  pinned: boolean;
  sortOrder: number;
};

export type BuildOptionOrderOptions = {
  /** Keep the original order (options that reference each other by letter). */
  lockOptions: boolean;
  /** Display index the correct option had last time; avoided when possible. */
  previousCorrectIndex?: number;
  rand: RandomInt;
  /** Extra reshuffles allowed while trying to avoid previousCorrectIndex. */
  maxRetries?: number;
};

/**
 * Fisher-Yates on a copy. Never sort(() => Math.random() - 0.5): that is biased,
 * and how badly depends on the engine's sort implementation.
 */
export function shuffled<T>(items: readonly T[], rand: RandomInt): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapWith = rand(index + 1);
    [result[index], result[swapWith]] = [result[swapWith], result[index]];
  }
  return result;
}

/**
 * Returns option ids in display order, which is what AttemptItem.optionOrder stores.
 *
 * In the printed book the correct answer is always the last option, so shuffling here is
 * what stops "always pick the last one" from working.
 */
export function buildOptionOrder(
  options: readonly OptionForOrder[],
  { lockOptions, previousCorrectIndex, rand, maxRetries = 5 }: BuildOptionOrderOptions,
): string[] {
  // The caller's array order is not trusted; sortOrder is the source of truth.
  const bySortOrder = [...options].sort((a, b) => a.sortOrder - b.sortOrder);
  if (lockOptions) return bySortOrder.map((option) => option.id);

  const free = bySortOrder.filter((option) => !option.pinned);
  const pinned = bySortOrder.filter((option) => option.pinned);
  const layout = () => [...shuffled(free, rand), ...pinned].map((option) => option.id);

  let order = layout();

  // Avoiding the previous position is only possible when the correct option can actually
  // move: it must exist, not be pinned, and have at least one other free option to trade
  // places with. Otherwise the rule is skipped rather than burning retries on it.
  const correct = bySortOrder.find((option) => option.isCorrect);
  if (previousCorrectIndex === undefined || correct === undefined || correct.pinned) return order;
  if (free.length < 2) return order;

  for (let retry = 0; retry < maxRetries && order[previousCorrectIndex] === correct.id; retry += 1) {
    order = layout();
  }
  return order;
}

/** Question order for a new attempt. */
export function buildQuestionOrder(ids: readonly string[], rand: RandomInt): string[] {
  return shuffled(ids, rand);
}
