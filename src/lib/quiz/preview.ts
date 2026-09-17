// Admin preview: several shuffles of a draft question's options, as display positions.
// Pure (the generator is a parameter), so the server action and the page that renders
// the first set share one implementation and it can be unit-tested.

import type { RandomInt } from "./random";
import { buildOptionOrder } from "./shuffle";

export type PreviewDraftOption = { isCorrect: boolean; pinned: boolean };

/** How many shuffles the admin preview shows. */
export const PREVIEW_SHUFFLES = 3;

/**
 * Each entry is one display order, holding indices into `options`. The draft has no
 * option ids yet, so the row's index stands in for one.
 */
export function buildPreviewOrders(
  options: readonly PreviewDraftOption[],
  lockOptions: boolean,
  rand: RandomInt,
  count: number = PREVIEW_SHUFFLES,
): number[][] {
  const forOrder = options.map((option, index) => ({
    id: String(index),
    isCorrect: option.isCorrect,
    pinned: option.pinned,
    sortOrder: index,
  }));
  return Array.from({ length: count }, () =>
    buildOptionOrder(forOrder, { lockOptions, rand }).map(Number),
  );
}
