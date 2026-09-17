"use client";

import { useId, useState, useTransition } from "react";
import { SaveIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { createPreset, updatePreset } from "@/server/actions/admin/presets";
import type { AdminPreset, AdminPresetsData } from "@/server/queries/admin/presets";

type Draft = {
  name: string;
  questionCount: string;
  timeLimitMin: string;
  sortOrder: string;
  isActive: boolean;
  /** Per subject id, as typed. An empty string counts as 0. */
  distribution: Record<string, string>;
};

const emptyDraft = (): Draft => ({
  name: "",
  questionCount: "40",
  timeLimitMin: "60",
  sortOrder: "0",
  isActive: true,
  distribution: {},
});

const draftOf = (preset: AdminPreset): Draft => ({
  name: preset.name,
  questionCount: String(preset.questionCount),
  timeLimitMin: String(preset.timeLimitMin),
  sortOrder: String(preset.sortOrder),
  isActive: preset.isActive,
  distribution: Object.fromEntries(
    Object.entries(preset.distribution ?? {}).map(([id, count]) => [id, String(count)]),
  ),
});

const numberOf = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

/**
 * Create or edit a preset. The per-subject editor shows how many ACTIVE questions each
 * subject has, and the running total next to the question count: those two must match
 * before the server will accept it.
 */
export function PresetForm({
  preset,
  bank,
  onDone,
  onCancel,
}: {
  /** null: a new preset. */
  preset: AdminPreset | null;
  bank: AdminPresetsData["bank"];
  onDone: () => void;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState<Draft>(() => (preset ? draftOf(preset) : emptyDraft()));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const distributionSum = Object.values(draft.distribution).reduce(
    (sum, value) => sum + numberOf(value),
    0,
  );
  const usesDistribution = distributionSum > 0;
  const questionCount = numberOf(draft.questionCount);
  const mismatch = usesDistribution && distributionSum !== questionCount;

  const save = () => {
    if (saving) return;
    setError(null);
    const body = {
      name: draft.name,
      questionCount,
      timeLimitMin: numberOf(draft.timeLimitMin),
      sortOrder: numberOf(draft.sortOrder),
      isActive: draft.isActive,
      // All zeros means "draw from the whole bank"; the server normalizes it to null.
      distribution: usesDistribution
        ? Object.fromEntries(
            Object.entries(draft.distribution).map(([id, value]) => [id, numberOf(value)]),
          )
        : null,
    };

    startSaving(async () => {
      const result = preset
        ? await updatePreset({ presetId: preset.id, ...body })
        : await createPreset(body);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone();
    });
  };

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={`${fieldId}-name`}>Нэр</Label>
          <Input
            id={`${fieldId}-name`}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            className="h-9"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-count`}>Асуултын тоо</Label>
          <Input
            id={`${fieldId}-count`}
            type="number"
            min={1}
            value={draft.questionCount}
            onChange={(event) => setDraft({ ...draft, questionCount: event.target.value })}
            className="h-9 tabular-nums"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-minutes`}>Хугацаа (минут)</Label>
          <Input
            id={`${fieldId}-minutes`}
            type="number"
            min={1}
            value={draft.timeLimitMin}
            onChange={(event) => setDraft({ ...draft, timeLimitMin: event.target.value })}
            className="h-9 tabular-nums"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${fieldId}-order`}>Эрэмбэ</Label>
          <Input
            id={`${fieldId}-order`}
            type="number"
            min={0}
            value={draft.sortOrder}
            onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
            className="h-9 w-24 tabular-nums"
          />
        </div>

        <Label className="flex items-center gap-3 self-end font-normal">
          <Switch
            checked={draft.isActive}
            onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
          />
          Идэвхтэй
        </Label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Судлагдахуунаар хуваарилах</legend>
        <p className="text-xs text-muted-foreground">
          Бүгдийг 0 орхивол бүх сангаас санамсаргүйгээр сонгоно. Хуваарилбал нийлбэр нь асуултын
          тоотой тэнцүү байх ёстой.
        </p>
        <ul className="flex flex-col gap-2">
          {bank.bySubject.map((subject) => (
            <li key={subject.id} className="flex flex-wrap items-center gap-3">
              <Label
                htmlFor={`${fieldId}-${subject.id}`}
                className="min-w-48 flex-1 font-normal"
              >
                {subject.name}
                <span className="ml-2 text-xs text-muted-foreground tabular-nums">
                  {subject.count} идэвхтэй
                </span>
              </Label>
              <Input
                id={`${fieldId}-${subject.id}`}
                type="number"
                min={0}
                max={subject.count}
                value={draft.distribution[subject.id] ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    distribution: { ...draft.distribution, [subject.id]: event.target.value },
                  })
                }
                placeholder="0"
                className={cn(
                  "h-9 w-24 tabular-nums",
                  numberOf(draft.distribution[subject.id] ?? "") > subject.count &&
                    "border-destructive",
                )}
              />
            </li>
          ))}
        </ul>
        <p
          className={cn(
            "text-sm tabular-nums",
            mismatch ? "text-destructive" : "text-muted-foreground",
          )}
        >
          Нийлбэр: {distributionSum} / {questionCount}
          {!usesDistribution && ` · хуваарилаагүй (бүх сан: ${bank.total} асуулт)`}
        </p>
      </fieldset>

      <p role="alert" className="text-sm text-destructive empty:hidden">
        {error}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving} className="h-9">
          <SaveIcon aria-hidden="true" />
          {saving ? "Хадгалж байна…" : preset ? "Хадгалах" : "Үүсгэх"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="h-9">
          Болих
        </Button>
      </div>
    </form>
  );
}
