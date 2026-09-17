"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVE_FILTERS,
  ACTIVE_FILTER_LABELS,
  EMPTY_FILTERS,
  FLAG_FILTERS,
  FLAG_FILTER_LABELS,
  questionFiltersToSearch,
  type ActiveFilter,
  type QuestionFilters,
} from "@/server/queries/admin/question-filters";

const ALL_SUBJECTS = "all";

/**
 * Every filter lives in the URL, so the table stays server-rendered and paginated and
 * any view can be linked or reloaded. Changing a filter always returns to page 1.
 */
export function QuestionFilterBar({
  filters,
  subjects,
  total,
}: {
  filters: QuestionFilters;
  subjects: { id: string; name: string }[];
  total: number;
}) {
  const router = useRouter();
  const searchId = useId();
  const subjectId = useId();
  const [search, setSearch] = useState(filters.q);
  const [pending, startTransition] = useTransition();

  const go = (overrides: Partial<QuestionFilters>) => {
    startTransition(() =>
      router.push(questionFiltersToSearch(filters, { ...overrides, page: 1 }), { scroll: false }),
    );
  };

  const subjectItems: Record<string, string> = {
    [ALL_SUBJECTS]: "Бүх судлагдахуун",
    ...Object.fromEntries(subjects.map((subject) => [subject.id, subject.name])),
  };
  const dirty = questionFiltersToSearch(filters) !== questionFiltersToSearch(EMPTY_FILTERS);

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: search.trim() });
        }}
      >
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <Label htmlFor={searchId}>Хайх</Label>
          <Input
            id={searchId}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Асуултын текст эсвэл код"
            className="h-9"
          />
        </div>

        <div className="flex min-w-48 flex-col gap-2">
          <Label htmlFor={subjectId}>Судлагдахуун</Label>
          <Select
            items={subjectItems}
            value={filters.subjectId ?? ALL_SUBJECTS}
            onValueChange={(value) =>
              go({ subjectId: value === ALL_SUBJECTS ? null : (value as string) })
            }
          >
            <SelectTrigger id={subjectId} className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(subjectItems).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" variant="outline" className="h-9">
          <SearchIcon aria-hidden="true" />
          Хайх
        </Button>
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            className="h-9"
            onClick={() => {
              setSearch("");
              startTransition(() => router.push(questionFiltersToSearch(EMPTY_FILTERS)));
            }}
          >
            <XIcon aria-hidden="true" />
            Цэвэрлэх
          </Button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-4">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Идэвх</legend>
          {ACTIVE_FILTERS.map((value: ActiveFilter) => (
            <label
              key={value}
              className={cn(
                "flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm",
                "has-checked:border-primary has-checked:bg-primary/5",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              )}
            >
              <input
                type="radio"
                name="active"
                value={value}
                checked={filters.active === value}
                onChange={() => go({ active: value })}
                className="size-3.5 accent-primary"
              />
              {ACTIVE_FILTER_LABELS[value]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          {FLAG_FILTERS.map((flag) => (
            <Label key={flag} className="flex items-center gap-2 text-sm font-normal">
              <Checkbox
                checked={filters[flag]}
                onCheckedChange={(checked) => go({ [flag]: checked === true })}
              />
              {FLAG_FILTER_LABELS[flag]}
            </Label>
          ))}
        </div>

        <p className="ml-auto text-sm text-muted-foreground tabular-nums">Нийт {total} асуулт</p>
      </div>
    </div>
  );
}
