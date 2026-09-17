// Builds what the attempt player may see of one item. Pure, so the rule "no correctness
// data before an item may be revealed" is unit-tested rather than trusted.

import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";

export type PlayerOption = { id: string; text: string };

export type PlayerItemResult = {
  isCorrect: boolean;
  correctOptionId: string;
  explanation: string | null;
};

export type PlayerItem = {
  id: string;
  /** 1-based, as shown to the user. */
  position: number;
  questionId: string;
  text: string;
  imageUrl: string | null;
  subjectName: string;
  /** In display order (AttemptItem.optionOrder). Never carries isCorrect. */
  options: PlayerOption[];
  selectedOptionId: string | null;
  flagged: boolean;
  bookmarked: boolean;
  /** Null until the item may be revealed; the only place correctness ever appears. */
  result: PlayerItemResult | null;
};

export type RawPlayerItem = {
  id: string;
  position: number;
  optionOrder: string[];
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  flagged: boolean;
  question: {
    id: string;
    text: string;
    imageUrl: string | null;
    explanation: string | null;
    subject: { name: string };
    options: { id: string; text: string; isCorrect: boolean }[];
  };
};

/**
 * Practice reveals an item once it is answered. An exam reveals nothing until the
 * attempt is over, and then reveals every item, answered or not.
 */
export function canRevealItem(
  mode: AttemptMode,
  status: AttemptStatus,
  answered: boolean,
): boolean {
  if (mode === AttemptMode.PRACTICE) return answered;
  return status !== AttemptStatus.IN_PROGRESS;
}

export function toPlayerItem(
  raw: RawPlayerItem,
  context: { mode: AttemptMode; status: AttemptStatus; bookmarked: boolean },
): PlayerItem {
  const byId = new Map(raw.question.options.map((option) => [option.id, option]));
  // Built field by field, never spread, so isCorrect cannot ride along.
  const options = raw.optionOrder.flatMap((optionId) => {
    const option = byId.get(optionId);
    return option ? [{ id: option.id, text: option.text }] : [];
  });

  const answered = raw.selectedOptionId !== null;
  let result: PlayerItemResult | null = null;
  if (canRevealItem(context.mode, context.status, answered)) {
    const correct = raw.question.options.find((option) => option.isCorrect);
    if (!correct) {
      // The import guarantees exactly one correct option; without one there is no
      // honest feedback to show.
      throw new Error(`Question ${raw.question.id} has no correct option.`);
    }
    result = {
      isCorrect: raw.isCorrect === true,
      correctOptionId: correct.id,
      explanation: raw.question.explanation,
    };
  }

  return {
    id: raw.id,
    position: raw.position + 1,
    questionId: raw.question.id,
    text: raw.question.text,
    imageUrl: raw.question.imageUrl,
    subjectName: raw.question.subject.name,
    options,
    selectedOptionId: raw.selectedOptionId,
    flagged: raw.flagged,
    bookmarked: context.bookmarked,
    result,
  };
}
