import Link from "next/link";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { AttemptSource } from "@/generated/prisma/enums";
import { REVIEW_TABS, type ReviewCounts, type ReviewTab } from "@/server/queries/progress";

/** Short tab wording; the longer description of each source stays in SOURCE_LABELS. */
export const REVIEW_TAB_LABELS: Record<ReviewTab, string> = {
  [AttemptSource.DUE]: "Давтах",
  [AttemptSource.WRONG]: "Алдсан",
  [AttemptSource.BOOKMARKED]: "Тэмдэглэсэн",
};

const SLUGS: Record<ReviewTab, string> = {
  [AttemptSource.DUE]: "due",
  [AttemptSource.WRONG]: "wrong",
  [AttemptSource.BOOKMARKED]: "bookmarked",
};

/** Anything unknown falls back to the first tab. */
export function parseReviewTab(value: unknown): ReviewTab {
  return REVIEW_TABS.find((tab) => SLUGS[tab] === value) ?? REVIEW_TABS[0];
}

export function reviewHref(tab: ReviewTab, page = 1): string {
  return page > 1 ? `/review?tab=${SLUGS[tab]}&page=${page}` : `/review?tab=${SLUGS[tab]}`;
}

/**
 * Links, not a client tab widget: the list under them is server-rendered and paged
 * through the URL, so each tab is its own address and survives a reload.
 */
export function ReviewTabs({ current, counts }: { current: ReviewTab; counts: ReviewCounts }) {
  return (
    <nav aria-label="Давтах жагсаалтууд">
      <ul className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {REVIEW_TABS.map((tab) => {
          const active = tab === current;
          return (
            <li key={tab} className="flex-1">
              <Link
                href={reviewHref(tab)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors sm:h-8",
                  active
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {REVIEW_TAB_LABELS[tab]}
                <Badge variant={active ? "secondary" : "outline"} className="tabular-nums">
                  {counts[tab]}
                  <span className="sr-only"> асуулт</span>
                </Badge>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
