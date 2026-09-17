"use client";

import { useId, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { SummaryQuestion } from "@/components/practice/summary-question";
import type { PlayerItem } from "@/server/queries/player-item";

/** Every question of a finished exam, with the "Зөвхөн алдсан" filter. */
export function ExamResultList({ items, total }: { items: PlayerItem[]; total: number }) {
  const filterId = useId();
  const [onlyMissed, setOnlyMissed] = useState(false);
  const missed = items.filter((item) => item.result && !item.result.isCorrect);
  const shown = onlyMissed ? missed : items;

  return (
    <section aria-labelledby={`${filterId}-heading`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${filterId}-heading`} className="text-lg font-semibold">
          Асуултууд
        </h2>
        <label htmlFor={filterId} className="flex items-center gap-2 text-sm">
          <Switch id={filterId} checked={onlyMissed} onCheckedChange={(checked) => setOnlyMissed(checked)} />
          Зөвхөн алдсан ({missed.length})
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Алдсан асуулт алга.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((item) => (
            <SummaryQuestion key={item.id} item={item} total={total} reportable />
          ))}
        </div>
      )}
    </section>
  );
}
