"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlayIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { mn } from "@/lib/i18n/mn";
import { createPracticeAttempt } from "@/server/actions/practice";
import {
  COUNTED_SOURCES,
  PRACTICE_COUNTS,
  type CountedSource,
  type PracticeCount,
} from "@/server/queries/question-sources";

const ALL_SUBJECTS = "all";

// Shared look for the radio "cards": the native radio stays visible and focusable.
const choiceClass = cn(
  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted",
  "has-checked:border-primary has-checked:bg-primary/5",
  "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
  "has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:hover:bg-transparent",
);

export function PracticeSetup({
  subjects,
  subjectId,
  counts,
}: {
  subjects: { id: string; name: string }[];
  subjectId: string | null;
  counts: Record<CountedSource, number>;
}) {
  const router = useRouter();
  const subjectFieldId = useId();
  const errorId = useId();
  const [source, setSource] = useState<CountedSource>("NEW");
  const [count, setCount] = useState<PracticeCount>(10);
  const [error, setError] = useState<string | null>(null);
  const [starting, startStarting] = useTransition();
  const [filtering, startFiltering] = useTransition();

  // Counts change with the subject; an empty choice falls to the first non-empty one.
  const firstAvailable = COUNTED_SOURCES.find((value) => counts[value] > 0);
  const selected = counts[source] > 0 ? source : (firstAvailable ?? source);
  const available = counts[selected];
  const nothingAvailable = firstAvailable === undefined;

  const subjectItems: Record<string, string> = {
    [ALL_SUBJECTS]: "Бүх судлагдахуун",
    ...Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
  };

  const changeSubject = (value: string | null) => {
    setError(null);
    const next = value && value !== ALL_SUBJECTS ? `/practice?subject=${value}` : "/practice";
    startFiltering(() => router.replace(next, { scroll: false }));
  };

  const start = () => {
    if (nothingAvailable || starting) return;
    setError(null);
    startStarting(async () => {
      // Only returns on failure; on success the action redirects to the attempt.
      const result = await createPracticeAttempt({ source: selected, count, subjectId });
      if (result?.error) setError(result.error);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Шинэ дадлага</CardTitle>
        <CardDescription>Асуултын төрөл, судлагдахуун, тоогоо сонгоно уу.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor={subjectFieldId}>Судлагдахуун</Label>
            <Select
              items={subjectItems}
              value={subjectId ?? ALL_SUBJECTS}
              onValueChange={(value) => changeSubject(value as string | null)}
              disabled={starting}
            >
              <SelectTrigger id={subjectFieldId} className="h-11 w-full sm:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(subjectItems).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="py-2">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset
            className={cn("flex flex-col gap-2 transition-opacity", filtering && "opacity-60")}
            aria-busy={filtering || undefined}
            disabled={starting}
          >
            <legend className="mb-2 text-sm font-medium">Асуултын төрөл</legend>
            {COUNTED_SOURCES.map((value) => (
              <label key={value} className={cn(choiceClass, "min-h-14")}>
                <input
                  type="radio"
                  name="source"
                  value={value}
                  checked={selected === value}
                  disabled={counts[value] === 0}
                  onChange={() => setSource(value)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{SOURCE_LABELS[value].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {SOURCE_LABELS[value].description}
                  </span>
                </span>
                <Badge variant="secondary" className="tabular-nums">
                  {counts[value]}
                  <span className="sr-only"> {mn.units.questions}</span>
                </Badge>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2" disabled={starting}>
            <legend className="mb-2 text-sm font-medium">Асуултын тоо</legend>
            <div className="grid grid-cols-3 gap-2">
              {PRACTICE_COUNTS.map((value) => (
                <label key={value} className={cn(choiceClass, "h-11 justify-center gap-2")}>
                  <input
                    type="radio"
                    name="count"
                    value={value}
                    checked={count === value}
                    onChange={() => setCount(value)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="text-sm font-medium tabular-nums">{value}</span>
                </label>
              ))}
            </div>
            {!nothingAvailable && available < count && (
              <p className="text-xs text-muted-foreground">
                Энэ төрөлд {available} асуулт байгаа тул {available} асуулттай дадлага үүснэ.
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            {nothingAvailable && (
              <p className="text-sm text-muted-foreground">
                Энэ судлагдахуунд одоогоор дадлага хийх асуулт алга.
              </p>
            )}
            <p id={errorId} role="alert" className="text-sm text-destructive empty:hidden">
              {error}
            </p>
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full text-base"
              disabled={nothingAvailable || starting || filtering}
              aria-describedby={error ? errorId : undefined}
            >
              <PlayIcon aria-hidden="true" />
              {starting ? mn.actions.preparing : mn.actions.startPractice}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
