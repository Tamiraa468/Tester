"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { focusMoveForKey, isChooseKey, moveFocusIndex } from "@/lib/quiz/keyboard";
import { letterFor } from "@/lib/quiz/letters";

export type AnswerOption = {
  id: string;
  text: string;
};

export type OptionListProps = {
  /** Already in display order: exactly what AttemptItem.optionOrder stores. */
  options: readonly AnswerOption[];
  selectedOptionId: string | null;
  /**
   * Only ever set once the answer may be revealed: after the user answered this item
   * (practice) or submitted the attempt (exam). Until then the browser must not know it.
   */
  correctOptionId?: string | null;
  /** Read-only: an answered practice item or a submitted attempt. */
  readOnly?: boolean;
  onChoose?: (optionId: string) => void;
  /** Labels the list for screen readers, e.g. the question number. */
  label: string;
};

/**
 * ARIA pattern: listbox, with selection that does NOT follow focus.
 *
 * Not a radio group: in the radio group pattern the arrow keys are defined to move
 * focus *and check* the radio, and here choosing an option submits the answer in
 * practice mode — arrowing through the list would answer the question four times.
 * The listbox pattern is the one APG allows to decouple selection from focus, exactly
 * for options whose selection has a consequence, so arrows only move focus and
 * Enter/Space (or a click, or the option's digit) commits.
 */
export function OptionList({
  options,
  selectedOptionId,
  correctOptionId,
  readOnly = false,
  onChoose,
  label,
}: OptionListProps) {
  const selectedIndex = options.findIndex((option) => option.id === selectedOptionId);
  // Roving tabindex: the list is one tab stop, and it starts on the chosen option.
  const [focusIndex, setFocusIndex] = useState(() => Math.max(selectedIndex, 0));
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  // Only steal focus after a key moved it, never on render or on a parent re-render.
  const pendingFocus = useRef<number | null>(null);

  useEffect(() => {
    const index = pendingFocus.current;
    if (index === null) return;
    pendingFocus.current = null;
    itemRefs.current[index]?.focus();
  });

  const choose = (index: number) => {
    const option = options[index];
    if (!option || readOnly || !onChoose) return;
    setFocusIndex(index);
    onChoose(option.id);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const move = focusMoveForKey(event.key);
    if (move) {
      const next = moveFocusIndex(focusIndex, options.length, move);
      if (next < 0) return;
      event.preventDefault();
      pendingFocus.current = next;
      setFocusIndex(next);
      return;
    }

    if (isChooseKey(event.key)) {
      // Space would scroll the page; Enter would submit a surrounding form.
      event.preventDefault();
      choose(focusIndex);
    }
  };

  return (
    <div
      role="listbox"
      aria-label={label}
      aria-orientation="vertical"
      aria-readonly={readOnly || undefined}
      className="flex flex-col gap-2"
      onKeyDown={handleKeyDown}
    >
      {options.map((option, index) => {
        const isSelected = option.id === selectedOptionId;
        const isCorrect = correctOptionId != null && option.id === correctOptionId;
        const isWrongChoice = isSelected && correctOptionId != null && !isCorrect;

        return (
          <div
            key={option.id}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            role="option"
            aria-selected={isSelected}
            tabIndex={index === focusIndex ? 0 : -1}
            onClick={() => choose(index)}
            onFocus={() => setFocusIndex(index)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors outline-none",
              "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted",
              isSelected && correctOptionId == null && "border-primary bg-primary/5",
              isCorrect && "border-success/50 bg-success/10",
              isWrongChoice && "border-destructive/50 bg-destructive/10",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                isSelected &&
                  correctOptionId == null &&
                  "border-transparent bg-primary text-primary-foreground",
                isCorrect && "border-transparent bg-success text-success-foreground",
                isWrongChoice && "border-transparent bg-destructive text-background",
              )}
            >
              {letterFor(index)}
            </span>

            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm leading-relaxed break-words">{option.text}</span>
              {/* Never colour alone: the state is also spelled out, and read out with the option. */}
              {isCorrect && (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                  {isSelected ? "Таны хариулт — зөв" : "Зөв хариулт"}
                </span>
              )}
              {isWrongChoice && (
                <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <XIcon className="size-3.5" aria-hidden="true" />
                  Таны хариулт — буруу
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
