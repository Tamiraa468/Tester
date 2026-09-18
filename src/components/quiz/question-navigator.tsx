"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { Switch } from "@/components/ui/switch";
import { mn } from "@/lib/i18n/mn";

export type NavigatorItem = {
  position: number;
  answered: boolean;
  flagged: boolean;
};

const swatchBase = "size-4 shrink-0 rounded-md border";

/**
 * Exam navigator: jump to any question, and see at a glance what is left. It shows
 * only answered / "Эргэж харах" / current, never whether an answer is right.
 */
export function QuestionNavigator({
  items,
  currentPosition,
  onJump,
  filterable = false,
}: {
  items: readonly NavigatorItem[];
  currentPosition: number;
  onJump?: (position: number) => void;
  /** Adds the "Зөвхөн хариулаагүй" filter. */
  filterable?: boolean;
}) {
  const headingId = useId();
  const filterId = useId();
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const shown = onlyUnanswered ? items.filter((item) => !item.answered) : items;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-medium">
          {mn.quiz.questionList}
        </h2>
        {filterable && (
          <label htmlFor={filterId} className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch
              id={filterId}
              size="sm"
              checked={onlyUnanswered}
              onCheckedChange={(checked) => setOnlyUnanswered(checked)}
            />
            {mn.quiz.onlyUnanswered}
          </label>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{mn.quiz.allAnswered}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
          {shown.map((item) => {
            const isCurrent = item.position === currentPosition;
            // Spelled out for screen readers: colour and the corner dot are not enough.
            const state = [
              item.answered ? mn.quiz.answered.toLowerCase() : mn.quiz.unanswered.toLowerCase(),
              item.flagged ? mn.quiz.flag.toLowerCase() : null,
            ].filter(Boolean);

            return (
              <button
                key={item.position}
                type="button"
                onClick={() => onJump?.(item.position)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`${mn.units.question} ${item.position}, ${state.join(", ")}`}
                className={cn(
                  "relative flex aspect-square items-center justify-center rounded-md border text-sm tabular-nums transition-colors outline-none",
                  "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  item.answered
                    ? "border-primary/30 bg-primary/10 font-medium text-foreground"
                    : "border-border text-muted-foreground",
                  item.flagged && "border-warning",
                  isCurrent && "border-ring ring-3 ring-ring/50",
                )}
              >
                {item.position}
                {item.flagged && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-warning"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-primary/30 bg-primary/10")} />
          {mn.quiz.answered}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-border")} />
          {mn.quiz.unanswered}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "relative border-warning")}>
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-warning" />
          </span>
          {mn.quiz.flag}
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-ring ring-3 ring-ring/50")} />
          {mn.quiz.currentQuestion}
        </li>
      </ul>
    </section>
  );
}
