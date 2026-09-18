"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, CircleCheckIcon, CloudOffIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AttemptHeader } from "@/components/quiz/attempt-header";
import { KeyboardHelpDialog } from "@/components/quiz/keyboard-help-dialog";
import { QuestionCard } from "@/components/quiz/question-card";
import { QuestionNavigator } from "@/components/quiz/question-navigator";
import { FinishExamDialog } from "@/components/exam/finish-exam-dialog";
import { useAnswerSaver, type SaveStatus } from "@/components/exam/use-answer-saver";
import { useExamCountdown } from "@/components/exam/use-exam-countdown";
import { mn } from "@/lib/i18n/mn";
import { getExamClock, submitExam, toggleReviewMark } from "@/server/actions/exam";
import type { ExamPlayerProps } from "@/server/queries/exam-player";

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === "idle") return null;
  if (status === "error") {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1 text-xs font-medium text-destructive underline-offset-2 hover:underline"
      >
        <CloudOffIcon className="size-3.5" aria-hidden="true" />
        {mn.quiz.unsaved} · {mn.actions.retry.toLowerCase()}
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === "saving" ? (
        <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <CircleCheckIcon className="size-3.5 text-success" aria-hidden="true" />
      )}
      {status === "saving" ? mn.quiz.saving : mn.quiz.saved}
    </span>
  );
}

/**
 * The exam shell. It stays mounted while ?i= changes, so the countdown, the save queue
 * and local answers survive moving between questions; only the question card is
 * replaced. Nothing here knows or shows whether an answer is right.
 */
export function ExamPlayer({
  attemptId,
  presetName,
  item,
  total,
  isFirst,
  isLast,
  states,
  deadline,
  serverNow,
}: ExamPlayerProps) {
  const router = useRouter();
  const [navigating, startNavigating] = useTransition();
  const [submitting, startSubmitting] = useTransition();
  const [flagging, startFlagging] = useTransition();
  const [flagOverrides, setFlagOverrides] = useState<Record<number, boolean>>({});
  const [answeredOverrides, setAnsweredOverrides] = useState<Record<number, boolean>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const leaving = useRef(false);
  const finishing = useRef(false);

  const syncRef = useRef<(serverNow: string) => void>(() => undefined);
  const onServerTime = useCallback((time: string) => syncRef.current(time), []);
  const onClosed = useCallback(
    (message: string) => {
      toast.error(message);
      leaving.current = true;
      router.refresh();
    },
    [router],
  );
  const saver = useAnswerSaver({ onServerTime, onClosed });

  const finish = (auto: boolean) => {
    if (finishing.current) return;
    finishing.current = true;
    leaving.current = true;
    if (auto) toast.info("Хугацаа дууслаа. Шалгалтыг дуусгаж байна…");
    startSubmitting(async () => {
      saver.retryAll();
      await saver.whenIdle();
      // Redirects to the result; only returns on failure.
      const result = await submitExam(attemptId);
      if (result?.error) {
        finishing.current = false;
        leaving.current = false;
        toast.error(result.error);
      }
    });
  };

  const countdown = useExamCountdown({ deadline, serverNow, onExpire: () => finish(true) });
  const syncClock = countdown.sync;
  useEffect(() => {
    syncRef.current = syncClock;
  }, [syncClock]);

  // After a long sleep, re-read the server clock rather than trusting the device.
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      const clock = await getExamClock(attemptId).catch(() => null);
      if (clock && !("error" in clock)) syncClock(clock.serverNow);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [attemptId, syncClock]);

  // Warn before a reload or closing the tab while the exam is running.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const selectedOptionId =
    item.id in saver.answers ? saver.answers[item.id] : item.selectedOptionId;
  const flagged = flagOverrides[item.position] ?? item.flagged;
  const merged = states.map((state) => ({
    position: state.position,
    answered:
      state.position === item.position
        ? selectedOptionId !== null
        : (answeredOverrides[state.position] ?? state.answered),
    flagged: flagOverrides[state.position] ?? state.flagged,
  }));
  const answeredCount = merged.filter((state) => state.answered).length;
  const flaggedCount = merged.filter((state) => state.flagged).length;
  const timeUp = countdown.remainingMs !== null && countdown.remainingMs <= 0;
  const locked = timeUp || submitting;

  const choose = (optionId: string | null) => {
    if (locked) return;
    setAnsweredOverrides((current) => ({ ...current, [item.position]: optionId !== null }));
    saver.save(item.id, optionId);
  };

  const go = (position: number) => {
    if (position < 1 || position > total || position === item.position) return;
    setSheetOpen(false);
    startNavigating(() => router.push(`/exam/${attemptId}?i=${position}`));
  };

  const toggleFlag = () => {
    if (flagging || locked) return;
    const previous = flagged;
    setFlagOverrides((current) => ({ ...current, [item.position]: !previous }));
    startFlagging(async () => {
      const result = await toggleReviewMark(item.id).catch(() => ({
        error: mn.errors.network,
        closed: undefined,
      }));
      if ("error" in result) {
        setFlagOverrides((current) => ({ ...current, [item.position]: previous }));
        if (result.closed) onClosed(result.error);
        else toast.error(result.error);
        return;
      }
      setFlagOverrides((current) => ({ ...current, [item.position]: result.flagged }));
    });
  };

  const navigator = (
    <QuestionNavigator items={merged} currentPosition={item.position} onJump={go} filterable />
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      {/* One h1 per document; the visible preset name in the sticky bar is a caption. */}
      <h1 className="sr-only">{presetName ?? mn.nav.exam}</h1>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="sticky top-14 z-20 -mx-4 flex flex-col gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              {presetName && <p className="truncate text-sm font-semibold">{presetName}</p>}
              <SaveIndicator status={saver.status} onRetry={saver.retryAll} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 px-3 sm:h-7 sm:px-2.5"
              disabled={submitting}
              onClick={() => setFinishOpen(true)}
            >
              {mn.actions.finish}
            </Button>
          </div>
          <AttemptHeader
            position={item.position}
            total={total}
            answeredCount={answeredCount}
            remainingSeconds={
              countdown.remainingMs === null ? undefined : Math.ceil(countdown.remainingMs / 1000)
            }
          />
        </div>

        <QuestionCard
          key={item.id}
          mode="exam"
          position={item.position}
          total={total}
          subject={item.subjectName}
          text={item.text}
          imageUrl={item.imageUrl}
          options={item.options}
          selectedOptionId={selectedOptionId}
          onChoose={choose}
          busy={locked}
          flagged={flagged}
          flagPending={flagging || locked}
          onToggleFlag={toggleFlag}
          onNext={() => go(item.position + 1)}
          onPrevious={() => go(item.position - 1)}
          onShowHelp={() => setHelpOpen(true)}
          keyboardScope="document"
          shortcutsEnabled={!helpOpen && !sheetOpen && !finishOpen}
          focusOnMount
        />

        {selectedOptionId !== null && !locked && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 self-start px-3 sm:h-7 sm:px-2.5"
            onClick={() => choose(null)}
          >
            <XIcon aria-hidden="true" />
            {mn.actions.clearAnswer}
          </Button>
        )}

        {/* Under the thumb on phones; the navigator opens as a sheet from here. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex min-h-16 items-center gap-2 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:min-h-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 sm:h-9 sm:flex-none"
            disabled={isFirst || navigating}
            onClick={() => go(item.position - 1)}
          >
            <ChevronLeftIcon aria-hidden="true" />
            {mn.actions.previous}
          </Button>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger
              render={
                <Button type="button" variant="secondary" className="h-11 flex-1 tabular-nums lg:hidden" />
              }
            >
              {mn.quiz.questionList} {answeredCount}/{total}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{mn.quiz.questionList}</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6">{navigator}</div>
            </SheetContent>
          </Sheet>

          {isLast ? (
            <Button
              type="button"
              className="h-11 flex-1 sm:ml-auto sm:h-9 sm:flex-none"
              disabled={submitting}
              onClick={() => setFinishOpen(true)}
            >
              {mn.actions.finishExam}
            </Button>
          ) : (
            <Button
              type="button"
              className="h-11 flex-1 sm:ml-auto sm:h-9 sm:flex-none"
              disabled={navigating}
              onClick={() => go(item.position + 1)}
            >
              {mn.actions.next}
              <ChevronRightIcon aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-xl border p-4">{navigator}</div>
      </aside>

      {/* Announced once each at 10 and 1 minutes; the ticking clock itself is silent. */}
      <p aria-live="polite" className="sr-only">
        {countdown.announcement}
      </p>

      <FinishExamDialog
        open={finishOpen}
        onOpenChange={setFinishOpen}
        unanswered={total - answeredCount}
        flagged={flaggedCount}
        unsaved={saver.unsavedCount}
        pending={submitting}
        onConfirm={() => finish(false)}
      />
      <KeyboardHelpDialog open={helpOpen} onOpenChange={setHelpOpen} mode="exam" />
    </div>
  );
}
