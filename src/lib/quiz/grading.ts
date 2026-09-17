export type GradableOption = { id: string; isCorrect: boolean };

/** Unanswered, unknown and empty ids are simply not correct. */
export function isCorrectAnswer(
  selectedOptionId: string | null | undefined,
  options: readonly GradableOption[],
): boolean {
  if (!selectedOptionId) return false;
  return options.some((option) => option.id === selectedOptionId && option.isCorrect);
}

export type ScorableItem = {
  selectedOptionId?: string | null;
  isCorrect?: boolean | null;
};

export type Score = {
  correct: number;
  answered: number;
  total: number;
  percent: number;
};

/**
 * percent is measured over `total`, not `answered`: an item left unanswered is a lost
 * mark, not an excused one. An empty attempt scores 0 rather than NaN.
 */
export function scoreItems(items: readonly ScorableItem[]): Score {
  let correct = 0;
  let answered = 0;
  for (const item of items) {
    if (item.selectedOptionId) answered += 1;
    if (item.isCorrect === true) correct += 1;
  }
  const total = items.length;
  return {
    correct,
    answered,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
  };
}
