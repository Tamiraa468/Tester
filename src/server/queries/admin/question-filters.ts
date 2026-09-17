// Pure builders for the /admin/questions table: no database access, so the filter bar
// (a Client Component) can import the same definitions the query uses, and both the
// URL and the where clause are built from one place.

import type { Prisma } from "@/generated/prisma/client";

export const ADMIN_PAGE_SIZE = 20;

export const ACTIVE_FILTERS = ["all", "active", "inactive"] as const;
export type ActiveFilter = (typeof ACTIVE_FILTERS)[number];

export const ACTIVE_FILTER_LABELS: Record<ActiveFilter, string> = {
  all: "Бүгд",
  active: "Идэвхтэй",
  inactive: "Идэвхгүй",
};

/** The checkbox filters, in the order they are shown. */
export const FLAG_FILTERS = ["missingExplanation", "hasPinned", "locked"] as const;
export type FlagFilter = (typeof FLAG_FILTERS)[number];

export const FLAG_FILTER_LABELS: Record<FlagFilter, string> = {
  missingExplanation: "Тайлбаргүй",
  hasPinned: "Тогтмол хувилбартай",
  locked: "Дараалал түгжсэн",
};

export type QuestionFilters = {
  q: string;
  subjectId: string | null;
  active: ActiveFilter;
  missingExplanation: boolean;
  hasPinned: boolean;
  locked: boolean;
  page: number;
};

export const EMPTY_FILTERS: QuestionFilters = {
  q: "",
  subjectId: null,
  active: "all",
  missingExplanation: false,
  hasPinned: false,
  locked: false,
  page: 1,
};

type Param = string | string[] | undefined;

const single = (value: Param): string => (typeof value === "string" ? value.trim() : "");

/** Search params are user input: anything unknown falls back to the default. */
export function parseQuestionFilters(params: Record<string, Param>): QuestionFilters {
  const active = single(params.active);
  const page = Number(single(params.page));
  return {
    q: single(params.q).slice(0, 200),
    subjectId: single(params.subject) || null,
    active: (ACTIVE_FILTERS as readonly string[]).includes(active)
      ? (active as ActiveFilter)
      : "all",
    missingExplanation: single(params.missingExplanation) === "1",
    hasPinned: single(params.hasPinned) === "1",
    locked: single(params.locked) === "1",
    page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1,
  };
}

export function questionWhere(filters: QuestionFilters): Prisma.QuestionWhereInput {
  const and: Prisma.QuestionWhereInput[] = [];

  if (filters.q !== "") {
    // ILIKE on both columns. Case-insensitive matching of Cyrillic depends on the
    // database's collation; the database suite checks "цэц" finding "Цэц".
    and.push({
      OR: [
        { text: { contains: filters.q, mode: "insensitive" } },
        { code: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }
  if (filters.subjectId) and.push({ subjectId: filters.subjectId });
  if (filters.active !== "all") and.push({ isActive: filters.active === "active" });
  // An explanation that was cleared is stored as NULL, but a row imported long ago may
  // still hold an empty string.
  if (filters.missingExplanation) and.push({ OR: [{ explanation: null }, { explanation: "" }] });
  if (filters.hasPinned) and.push({ options: { some: { pinned: true } } });
  if (filters.locked) and.push({ lockOptions: true });

  return and.length === 0 ? {} : { AND: and };
}

/** The table's URL for these filters; `page` is dropped when it is the first one. */
export function questionFiltersToSearch(
  filters: QuestionFilters,
  overrides: Partial<QuestionFilters> = {},
): string {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.q !== "") params.set("q", merged.q);
  if (merged.subjectId) params.set("subject", merged.subjectId);
  if (merged.active !== "all") params.set("active", merged.active);
  for (const flag of FLAG_FILTERS) if (merged[flag]) params.set(flag, "1");
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return query === "" ? "/admin/questions" : `/admin/questions?${query}`;
}
