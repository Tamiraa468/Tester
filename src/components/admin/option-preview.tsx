"use client";

import { ShuffleIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { letterFor } from "@/lib/quiz/letters";

export type PreviewOption = { text: string; isCorrect: boolean; pinned: boolean };

/**
 * Three shuffles of the current draft, laid out exactly as an attempt would.
 *
 * The orders are computed on the server (shuffling belongs there, and a component must
 * never reach for Math.random): the page renders the first set, and the form asks for a
 * new one whenever the draft's SHAPE changes — how many options, which are pinned,
 * which is correct, whether the order is locked. Editing option text only re-labels
 * what is already on screen.
 */
export function OptionPreview({
  options,
  orders,
  lockOptions,
  pending,
  error,
  onReshuffle,
}: {
  options: readonly PreviewOption[];
  orders: readonly number[][];
  lockOptions: boolean;
  pending: boolean;
  error: string | null;
  onReshuffle: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {lockOptions
            ? "Дараалал түгжээтэй тул хольцгүй, эх дараалалдаа харагдана."
            : "Санамсаргүй 3 хувилбар. Тогтмол хувилбар үргэлж сүүлд үлдэнэ."}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={onReshuffle}
          disabled={pending}
        >
          <ShuffleIcon aria-hidden="true" />
          Дахин холих
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className={cn("grid gap-3 sm:grid-cols-3", pending && "opacity-60")} aria-busy={pending}>
        {orders.map((order, index) => (
          <ol key={index} className="flex flex-col gap-2 rounded-lg border p-3">
            {order.map((optionIndex, position) => {
              const option = options[optionIndex];
              if (!option) return null;
              return (
                <li key={position} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {letterFor(position)}.
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={cn("font-serif", option.text === "" && "text-muted-foreground")}
                    >
                      {option.text === "" ? "(хоосон)" : option.text}
                    </span>
                    <span className="flex flex-wrap gap-1 empty:hidden">
                      {option.isCorrect && (
                        <Badge variant="outline" className="border-success text-success">
                          Зөв
                        </Badge>
                      )}
                      {option.pinned && <Badge variant="outline">Тогтмол</Badge>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </div>
  );
}
