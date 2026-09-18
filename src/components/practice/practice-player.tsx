"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { AttemptHeader } from "@/components/quiz/attempt-header";
import { KeyboardHelpDialog } from "@/components/quiz/keyboard-help-dialog";
import { QuestionCard } from "@/components/quiz/question-card";
import { ReportQuestionDialog } from "@/components/quiz/report-question-dialog";
import { useBookmark } from "@/components/practice/use-bookmark";
import { mn } from "@/lib/i18n/mn";
import { isRepeatedActivation } from "@/lib/quiz/keyboard";
import {
  finishPracticeAttempt,
  reportQuestion,
  submitPracticeAnswer,
  type PracticeAnswerResult,
} from "@/server/actions/practice";
import type { PlayerItem } from "@/server/queries/player-item";

/**
 * One practice question. Render it with key={item.id} so every item starts fresh.
 *
 * Keyboard: digits answer from anywhere on the page; Enter/Space answer only from a
 * focused option. After answering, focus moves to the "next" button, so the next Enter
 * is a deliberate press on it, and a held Enter (auto-repeat) is ignored there.
 */
export function PracticePlayer({
  attemptId,
  item,
  total,
  answeredCount,
  isLast,
}: {
  attemptId: string;
  item: PlayerItem;
  total: number;
  answeredCount: number;
  isLast: boolean;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState<PracticeAnswerResult | null>(null);
  const [pendingOptionId, setPendingOptionId] = useState<string | null>(null);
  const [answering, startAnswering] = useTransition();
  const [navigating, startNavigating] = useTransition();
  const [reportOpen, setReportOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const bookmark = useBookmark(item.questionId, item.bookmarked);
  const nextRef = useRef<HTMLButtonElement>(null);

  // A refresh restores the stored result from the server; a fresh answer comes from the action.
  const result: PracticeAnswerResult | null =
    answer ??
    (item.result && item.selectedOptionId
      ? { ...item.result, selectedOptionId: item.selectedOptionId }
      : null);
  const answered = result !== null;
  const busy = answering || navigating;

  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);

  const choose = (optionId: string) => {
    if (answered || busy) return;
    setPendingOptionId(optionId);
    startAnswering(async () => {
      const response = await submitPracticeAnswer({ attemptItemId: item.id, optionId });
      if ("error" in response) {
        setPendingOptionId(null);
        toast.error(response.error);
        return;
      }
      setAnswer(response);
    });
  };

  const goNext = () => {
    if (busy) return;
    startNavigating(async () => {
      if (isLast) {
        // Redirects to the summary; only returns on failure.
        const response = await finishPracticeAttempt(attemptId);
        if (response?.error) toast.error(response.error);
        return;
      }
      router.push(`/practice/${attemptId}?i=${item.position + 1}`);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* The player has no visible page title — the question is the content — but the
          document still needs one h1 to be navigable. */}
      <h1 className="sr-only">{mn.nav.practice}</h1>
      <AttemptHeader position={item.position} total={total} answeredCount={answeredCount} />

      <QuestionCard
        mode="practice"
        position={item.position}
        total={total}
        subject={item.subjectName}
        text={item.text}
        imageUrl={item.imageUrl}
        options={item.options}
        selectedOptionId={result?.selectedOptionId ?? pendingOptionId}
        correctOptionId={result?.correctOptionId ?? null}
        explanation={result?.explanation ?? null}
        onChoose={choose}
        busy={busy}
        bookmarked={bookmark.bookmarked}
        bookmarkPending={bookmark.pending}
        onToggleBookmark={bookmark.toggle}
        onShowHelp={() => setHelpOpen(true)}
        keyboardScope="document"
        shortcutsEnabled={!reportOpen && !helpOpen}
        focusOnMount={!answered}
      />

      {/* The action bar stays under the thumb on a phone whether or not the question is
          answered, so its position never shifts mid-question and the explanation can
          push the page down behind it. From sm up it goes back into the flow. */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 flex min-h-16 items-center gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur",
          "sm:static sm:mx-0 sm:min-h-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
        )}
      >
        <ReportQuestionDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          onSubmit={(message) => reportQuestion({ questionId: item.questionId, message })}
        />
        {answered && (
          <Button
            ref={nextRef}
            type="button"
            size="lg"
            className="ml-auto h-11 flex-1 px-4 text-base sm:flex-none"
            disabled={navigating}
            onClick={goNext}
            onKeyDown={(event) => {
              if (isRepeatedActivation(event)) event.preventDefault();
            }}
          >
            {isLast ? mn.actions.showResult : mn.actions.nextQuestion}
            <ArrowRightIcon aria-hidden="true" />
          </Button>
        )}
      </div>

      <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} mode="practice" />
    </div>
  );
}
