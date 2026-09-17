"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookmarkButton } from "@/components/quiz/bookmark-button";
import { FlagButton } from "@/components/quiz/flag-button";
import { KeyboardHints } from "@/components/quiz/keyboard-hints";
import { OptionList, type AnswerOption } from "@/components/quiz/option-list";
import { optionIndexForDigit } from "@/lib/quiz/keyboard";

export type QuestionCardProps = {
  mode: "practice" | "exam";
  position: number;
  total: number;
  subject?: string;
  text: string;
  /** Display order, as stored in AttemptItem.optionOrder. */
  options: readonly AnswerOption[];
  selectedOptionId: string | null;
  /** Set only once the answer may be revealed (answered in practice, submitted in exam). */
  correctOptionId?: string | null;
  explanation?: string | null;
  onChoose?: (optionId: string) => void;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  flagged?: boolean;
  onToggleFlag?: () => void;
};

/**
 * Reads the shortcut from event.code, not event.key: on a Mongolian keyboard layout
 * the physical F and number keys produce Cyrillic characters, and the shortcuts are
 * about the keys the user presses.
 */
function shortcutFor(event: React.KeyboardEvent<HTMLDivElement>): string {
  const digit = /^Digit([1-9])$/.exec(event.code);
  if (digit) return digit[1];
  if (event.code === "KeyF") return "f";
  return event.key.toLowerCase();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
}

export function QuestionCard({
  mode,
  position,
  total,
  subject,
  text,
  options,
  selectedOptionId,
  correctOptionId,
  explanation,
  onChoose,
  bookmarked,
  onToggleBookmark,
  flagged,
  onToggleFlag,
}: QuestionCardProps) {
  const revealed = correctOptionId != null;
  // In practice mode a revealed item is settled; in exam mode the answer stays editable
  // until the attempt is submitted (which is the only time correctOptionId is sent).
  const readOnly = revealed;
  const wasCorrect = revealed && selectedOptionId === correctOptionId;

  // Card-level so the shortcuts keep working while focus is on the flag or bookmark
  // button; key events from the option list bubble up to here.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (isTypingTarget(event.target)) return;

    const key = shortcutFor(event);

    if (key === "f" && mode === "exam" && onToggleFlag) {
      event.preventDefault();
      onToggleFlag();
      return;
    }

    const index = optionIndexForDigit(key, options.length);
    if (index === null || readOnly || !onChoose) return;
    event.preventDefault();
    onChoose(options[index].id);
  };

  return (
    <Card onKeyDown={handleKeyDown}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">
            Асуулт {position} / {total}
          </span>
          {subject && <Badge variant="outline">{subject}</Badge>}
        </CardTitle>
        <CardAction>
          {mode === "exam" ? (
            <FlagButton flagged={flagged ?? false} onToggle={onToggleFlag} />
          ) : (
            <BookmarkButton bookmarked={bookmarked ?? false} onToggle={onToggleBookmark} />
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="font-serif text-lg leading-relaxed break-words">{text}</p>

        <OptionList
          options={options}
          selectedOptionId={selectedOptionId}
          correctOptionId={correctOptionId}
          readOnly={readOnly}
          onChoose={onChoose}
          label={`Асуулт ${position}-ийн хариултууд`}
        />

        {revealed && (
          <div
            // Practice reveals the result the moment the user answers, so it has to be
            // announced rather than silently appear below the options.
            role="status"
            className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3"
          >
            <p
              className={
                wasCorrect
                  ? "flex items-center gap-1.5 text-sm font-medium text-success"
                  : "flex items-center gap-1.5 text-sm font-medium text-destructive"
              }
            >
              {wasCorrect ? (
                <CheckIcon className="size-4" aria-hidden="true" />
              ) : (
                <XIcon className="size-4" aria-hidden="true" />
              )}
              {wasCorrect ? "Зөв хариуллаа" : "Буруу хариуллаа"}
            </p>
            {explanation && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">Тайлбар</p>
                <p className="font-serif text-sm leading-relaxed">{explanation}</p>
              </div>
            )}
          </div>
        )}

        {!readOnly && <KeyboardHints showFlag={mode === "exam"} />}
      </CardContent>
    </Card>
  );
}
