"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import { CheckIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookmarkButton } from "@/components/quiz/bookmark-button";
import { FlagButton } from "@/components/quiz/flag-button";
import { KeyboardHints } from "@/components/quiz/keyboard-hints";
import { OptionList, type AnswerOption } from "@/components/quiz/option-list";
import { mn } from "@/lib/i18n/mn";
import { shortcutFor, type ShortcutKeyEvent } from "@/lib/quiz/keyboard";

export type QuestionCardProps = {
  mode: "practice" | "exam";
  position: number;
  total: number;
  subject?: string;
  text: string;
  imageUrl?: string | null;
  /** Display order, as stored in AttemptItem.optionOrder. */
  options: readonly AnswerOption[];
  selectedOptionId: string | null;
  /** Set only once the answer may be revealed (answered in practice, submitted in exam). */
  correctOptionId?: string | null;
  explanation?: string | null;
  onChoose?: (optionId: string) => void;
  /** An answer is being saved or the page is changing: options are disabled. */
  busy?: boolean;
  bookmarked?: boolean;
  bookmarkPending?: boolean;
  onToggleBookmark?: () => void;
  flagged?: boolean;
  flagPending?: boolean;
  onToggleFlag?: () => void;
  /** Exam: KeyN / KeyP. */
  onNext?: () => void;
  onPrevious?: () => void;
  onShowHelp?: () => void;
  /**
   * "card": shortcuts work while focus is inside this card (several cards on a page).
   * "document": they work anywhere on the page (the attempt player, one card).
   */
  keyboardScope?: "card" | "document";
  /** Off while the page has a dialog of its own open. */
  shortcutsEnabled?: boolean;
  focusOnMount?: boolean;
};

type ShortcutEvent = ShortcutKeyEvent & {
  target: EventTarget | null;
  defaultPrevented: boolean;
  preventDefault(): void;
};

/** Typing in a field, or anything inside a dialog, never triggers a quiz shortcut. */
function isShortcutBlocked(target: EventTarget | null): boolean {
  if (typeof document !== "undefined" && document.querySelector('[role="dialog"], [role="alertdialog"]')) {
    // Dialogs are unmounted when closed, so any dialog in the DOM is an open one.
    return true;
  }
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.closest('[role="dialog"], [role="alertdialog"]') !== null
  );
}

/** Absolute URLs are shown as-is: allowing any host would make the optimizer an open proxy. */
function isRemoteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

export function QuestionCard({
  mode,
  position,
  total,
  subject,
  text,
  imageUrl,
  options,
  selectedOptionId,
  correctOptionId,
  explanation,
  onChoose,
  busy = false,
  bookmarked,
  bookmarkPending,
  onToggleBookmark,
  flagged,
  flagPending,
  onToggleFlag,
  onNext,
  onPrevious,
  onShowHelp,
  keyboardScope = "card",
  shortcutsEnabled = true,
  focusOnMount = false,
}: QuestionCardProps) {
  const textId = useId();
  const revealed = correctOptionId != null;
  // In practice mode a revealed item is settled; in exam mode the answer stays editable
  // until the attempt is submitted (which is the only time correctOptionId is sent).
  const readOnly = revealed;
  const wasCorrect = revealed && selectedOptionId === correctOptionId;
  // Spelled out in words, never signalled by the green or red alone.
  const verdict = wasCorrect
    ? mn.quiz.answeredCorrectly
    : selectedOptionId
      ? mn.quiz.answeredWrongly
      : mn.quiz.notAnswered;

  // Enter is deliberately not a shortcut here: it acts on whatever has focus (an option
  // answers, the "next" button advances), so it is never a surprise.
  const handleShortcut = (event: ShortcutEvent) => {
    if (!shortcutsEnabled || event.defaultPrevented || isShortcutBlocked(event.target)) return;
    const shortcut = shortcutFor(event);
    if (!shortcut) return;

    switch (shortcut.kind) {
      case "flag":
        if (mode !== "exam" || !onToggleFlag) return;
        event.preventDefault();
        onToggleFlag();
        return;
      case "next":
      case "previous": {
        const move = shortcut.kind === "next" ? onNext : onPrevious;
        if (mode !== "exam" || !move) return;
        event.preventDefault();
        move();
        return;
      }
      case "help":
        if (!onShowHelp) return;
        event.preventDefault();
        onShowHelp();
        return;
      case "option": {
        const option = options[shortcut.index];
        if (!option || readOnly || busy || !onChoose) return;
        event.preventDefault();
        onChoose(option.id);
        return;
      }
    }
  };

  // The document listener always calls the latest handler without re-subscribing.
  const handlerRef = useRef(handleShortcut);
  useEffect(() => {
    handlerRef.current = handleShortcut;
  });
  useEffect(() => {
    if (keyboardScope !== "document") return;
    const listener = (event: KeyboardEvent) => handlerRef.current(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [keyboardScope]);

  return (
    <Card onKeyDown={keyboardScope === "card" ? handleShortcut : undefined}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span className="tabular-nums">
            {mn.units.question} {position} / {total}
          </span>
          {subject && <Badge variant="outline">{subject}</Badge>}
        </CardTitle>
        <CardAction>
          {mode === "exam" ? (
            <FlagButton flagged={flagged ?? false} onToggle={onToggleFlag} disabled={flagPending} />
          ) : (
            <BookmarkButton
              bookmarked={bookmarked ?? false}
              onToggle={onToggleBookmark}
              disabled={bookmarkPending}
            />
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p id={textId} className="reading measure font-serif break-words">
          {text}
        </p>

        {imageUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted/40">
            <Image
              src={imageUrl}
              alt={mn.quiz.questionImage}
              fill
              sizes="(min-width: 768px) 672px, 100vw"
              unoptimized={isRemoteUrl(imageUrl)}
              className="object-contain"
            />
          </div>
        )}

        <OptionList
          options={options}
          selectedOptionId={selectedOptionId}
          correctOptionId={correctOptionId}
          readOnly={readOnly}
          busy={busy}
          onChoose={onChoose}
          labelledBy={textId}
          focusOnMount={focusOnMount}
        />

        {/* Always mounted, so the verdict announces as a *change* of text once the user
            answers. A live region that appears already populated is announced
            inconsistently across screen readers. Only the verdict is spoken: the
            explanation is there to be read, not recited over the top of it. */}
        <p aria-live="polite" aria-atomic="true" className="sr-only">
          {revealed ? verdict : ""}
        </p>

        {revealed && (
          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <p
              // aria-hidden: the live region above already says this.
              aria-hidden="true"
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
              {verdict}
            </p>
            {explanation && (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {mn.quiz.explanation}
                </p>
                <p className="reading-sm measure font-serif">{explanation}</p>
              </div>
            )}
          </div>
        )}

        {!readOnly && <KeyboardHints mode={mode} onShowHelp={onShowHelp} />}
      </CardContent>
    </Card>
  );
}
