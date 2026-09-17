"use client";

import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { Progress } from "@/components/ui/progress";
import { formatClock } from "@/lib/quiz/time";

/** Under a minute left, the clock turns into a warning. */
const LOW_TIME_SECONDS = 60;

export function AttemptHeader({
  position,
  total,
  answeredCount,
  remainingSeconds,
}: {
  position: number;
  total: number;
  answeredCount: number;
  /** Exam only; practice has no clock. */
  remainingSeconds?: number;
}) {
  const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
  const lowOnTime = remainingSeconds !== undefined && remainingSeconds <= LOW_TIME_SECONDS;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span className="font-medium tabular-nums">
          Асуулт {position} / {total}
        </span>
        <span className="text-muted-foreground tabular-nums">
          Хариулсан {answeredCount} / {total}
        </span>
        {remainingSeconds !== undefined && (
          <span
            // Not a live region: a clock that announces every second is unusable.
            className={cn(
              "flex items-center gap-1.5 font-medium tabular-nums",
              lowOnTime ? "text-destructive" : "text-muted-foreground",
            )}
          >
            <ClockIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">Үлдсэн хугацаа</span>
            {formatClock(remainingSeconds)}
          </span>
        )}
      </div>
      <Progress value={percent} aria-label="Хариулсан асуултын явц" />
    </div>
  );
}
