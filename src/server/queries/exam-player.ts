// What the exam player page sends to the browser, built in one pure function so a test
// can check the exact payload: the current item only (without any correctness data),
// every item's answered / "Эргэж харах" state for the navigator, and the times.

import { AttemptStatus } from "@/generated/prisma/enums";
import { examDeadline } from "@/lib/quiz/exam-time";
import type { PlayerItem } from "./player-item";

export type ExamNavigatorState = {
  position: number;
  answered: boolean;
  flagged: boolean;
};

export type ExamPlayerProps = {
  attemptId: string;
  presetName: string | null;
  item: Omit<PlayerItem, "result">;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  states: ExamNavigatorState[];
  /** ISO timestamps; the client keeps its own offset to serverNow. */
  deadline: string | null;
  serverNow: string;
};

export function toExamPlayerProps(
  attempt: {
    id: string;
    status: AttemptStatus;
    presetName: string | null;
    startedAt: Date;
    timeLimitSec: number | null;
    items: readonly PlayerItem[];
  },
  index: number,
  serverNow: Date,
): ExamPlayerProps {
  if (attempt.status !== AttemptStatus.IN_PROGRESS) {
    throw new Error("The exam player only serves exams in progress.");
  }
  const current = attempt.items[index];
  if (!current) throw new Error(`No item at index ${index}.`);
  if (current.result !== null) {
    // canRevealItem never reveals a running exam; refuse rather than leak.
    throw new Error("A running exam item carries a result.");
  }

  // Picked field by field, so nothing new on PlayerItem reaches the browser by accident.
  const item: ExamPlayerProps["item"] = {
    id: current.id,
    position: current.position,
    questionId: current.questionId,
    text: current.text,
    imageUrl: current.imageUrl,
    subjectName: current.subjectName,
    options: current.options.map((option) => ({ id: option.id, text: option.text })),
    selectedOptionId: current.selectedOptionId,
    flagged: current.flagged,
    bookmarked: current.bookmarked,
  };

  const deadline = examDeadline(attempt.startedAt, attempt.timeLimitSec);
  return {
    attemptId: attempt.id,
    presetName: attempt.presetName,
    item,
    total: attempt.items.length,
    isFirst: index === 0,
    isLast: index === attempt.items.length - 1,
    states: attempt.items.map((entry) => ({
      position: entry.position,
      answered: entry.selectedOptionId !== null,
      flagged: entry.flagged,
    })),
    deadline: deadline?.toISOString() ?? null,
    serverNow: serverNow.toISOString(),
  };
}
