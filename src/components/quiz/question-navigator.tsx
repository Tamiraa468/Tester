"use client";

import { cn } from "cn";

export type NavigatorItem = {
  position: number;
  answered: boolean;
  flagged: boolean;
};

const swatchBase = "size-4 shrink-0 rounded-md border";

/** Exam navigator: jump to any question, and see at a glance what is left. */
export function QuestionNavigator({
  items,
  currentPosition,
  onJump,
}: {
  items: readonly NavigatorItem[];
  currentPosition: number;
  onJump?: (position: number) => void;
}) {
  return (
    <section aria-labelledby="navigator-heading" className="flex flex-col gap-3">
      <h2 id="navigator-heading" className="text-sm font-medium">
        Асуултууд
      </h2>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-2">
        {items.map((item) => {
          const isCurrent = item.position === currentPosition;
          // Spelled out for screen readers: colour and the corner dot are not enough.
          const state = [
            item.answered ? "хариулсан" : "хариулаагүй",
            item.flagged ? "эргэж харах" : null,
          ].filter(Boolean);

          return (
            <button
              key={item.position}
              type="button"
              onClick={() => onJump?.(item.position)}
              aria-current={isCurrent ? "true" : undefined}
              aria-label={`Асуулт ${item.position}, ${state.join(", ")}`}
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

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-primary/30 bg-primary/10")} />
          Хариулсан
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-border")} />
          Хариулаагүй
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "relative border-warning")}>
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-warning" />
          </span>
          Эргэж харах
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn(swatchBase, "border-ring ring-3 ring-ring/50")} />
          Одоогийн асуулт
        </li>
      </ul>
    </section>
  );
}
