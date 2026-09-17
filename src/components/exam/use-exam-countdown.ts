"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clockOffsetMs,
  crossedAnnouncement,
  remainingMs as remainingOnServerClock,
} from "@/lib/quiz/exam-time";

const ANNOUNCEMENTS: Record<number, string> = {
  [10 * 60_000]: "10 минут үлдлээ.",
  [60_000]: "1 минут үлдлээ.",
};

/**
 * Countdown on the server's clock. The device clock is only used to measure elapsed
 * time: the offset to the server is kept (and re-synced on every server response), so
 * a wrong device clock does not change the remaining time.
 */
export function useExamCountdown({
  deadline,
  serverNow,
  onExpire,
}: {
  deadline: string | null;
  serverNow: string;
  onExpire: () => void;
}) {
  const deadlineMs = deadline === null ? null : Date.parse(deadline);
  // First render uses the server's own reading, so server and client HTML agree.
  const initial = deadlineMs === null ? null : Math.max(deadlineMs - Date.parse(serverNow), 0);
  const [remaining, setRemaining] = useState<number | null>(initial);
  const [announcement, setAnnouncement] = useState("");
  const offset = useRef<number | null>(null);
  const previous = useRef<number | null>(initial);
  const expired = useRef(false);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  const sync = useCallback((serverNowIso: string) => {
    offset.current = clockOffsetMs(Date.parse(serverNowIso), Date.now());
  }, []);

  useEffect(() => {
    sync(serverNow);
  }, [serverNow, sync]);

  useEffect(() => {
    if (deadlineMs === null) return;
    const tick = () => {
      const next = remainingOnServerClock(deadlineMs, Date.now(), offset.current ?? 0);
      const crossed = crossedAnnouncement(previous.current ?? next, next);
      previous.current = next;
      if (crossed !== null) setAnnouncement(ANNOUNCEMENTS[crossed]);
      setRemaining(next);
      if (next <= 0 && !expired.current) {
        expired.current = true;
        onExpireRef.current();
      }
    };
    const first = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [deadlineMs]);

  return { remainingMs: remaining, announcement, sync };
}
