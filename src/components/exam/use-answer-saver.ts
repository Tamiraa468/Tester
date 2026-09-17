"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveExamAnswer } from "@/server/actions/exam";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const NETWORK_ERROR = "Сүлжээний алдаа гарлаа. Хариулт хадгалагдсангүй.";
const FAILED_TOAST_ID = "exam-save-failed";

/**
 * Autosave with one request at a time per item: only the latest choice is sent, so
 * quick changes can never arrive out of order. A failed save keeps the local choice
 * and offers a retry.
 */
export function useAnswerSaver({
  onServerTime,
  onClosed,
}: {
  onServerTime: (serverNow: string) => void;
  onClosed: (message: string) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [unsavedCount, setUnsavedCount] = useState(0);
  const wanted = useRef(new Map<string, string | null>());
  const failed = useRef(new Map<string, string | null>());
  const running = useRef(new Map<string, Promise<void>>());
  const closed = useRef(false);
  // The toast's retry button calls the latest retryAll (declared below flush).
  const retryAllRef = useRef<() => void>(() => undefined);

  const refreshStatus = useCallback(() => {
    setUnsavedCount(failed.current.size + wanted.current.size);
    if (running.current.size > 0) setStatus("saving");
    else if (failed.current.size > 0) setStatus("error");
    else setStatus("saved");
  }, []);

  const flush = useCallback(
    (itemId: string): Promise<void> => {
      const existing = running.current.get(itemId);
      if (existing) return existing;

      const run = (async () => {
        while (wanted.current.has(itemId) && !closed.current) {
          const optionId = wanted.current.get(itemId)!;
          wanted.current.delete(itemId);
          const result = await saveExamAnswer({ attemptItemId: itemId, optionId }).catch(() => ({
            error: NETWORK_ERROR,
            closed: undefined,
          }));
          if (!("error" in result)) {
            failed.current.delete(itemId);
            onServerTime(result.serverNow);
            continue;
          }
          if (result.closed) {
            closed.current = true;
            onClosed(result.error);
            return;
          }
          // Keep the choice for a retry, unless a newer one is already queued.
          if (!wanted.current.has(itemId)) failed.current.set(itemId, optionId);
          toast.error(result.error, {
            id: FAILED_TOAST_ID,
            action: { label: "Дахин оролдох", onClick: () => retryAllRef.current() },
          });
          return;
        }
      })().finally(() => {
        running.current.delete(itemId);
        refreshStatus();
      });

      running.current.set(itemId, run);
      refreshStatus();
      return run;
    },
    [onClosed, onServerTime, refreshStatus],
  );

  const retryAll = useCallback(() => {
    toast.dismiss(FAILED_TOAST_ID);
    for (const [itemId, optionId] of failed.current) {
      if (!wanted.current.has(itemId)) wanted.current.set(itemId, optionId);
      failed.current.delete(itemId);
      void flush(itemId);
    }
  }, [flush]);

  useEffect(() => {
    retryAllRef.current = retryAll;
  }, [retryAll]);

  const save = useCallback(
    (itemId: string, optionId: string | null) => {
      if (closed.current) return;
      setAnswers((current) => ({ ...current, [itemId]: optionId }));
      wanted.current.set(itemId, optionId);
      failed.current.delete(itemId);
      void flush(itemId);
    },
    [flush],
  );

  /** Resolves once nothing is being saved (used before submitting). */
  const whenIdle = useCallback(async () => {
    while (running.current.size > 0) {
      await Promise.allSettled([...running.current.values()]);
    }
  }, []);

  return { answers, status, unsavedCount, save, retryAll, whenIdle };
}
