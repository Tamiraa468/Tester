import Link from "next/link";
import { CircleCheckIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/states/empty-state";
import { RemoveBookmarkButton } from "@/components/review/remove-bookmark-button";
import { reviewHref } from "@/components/review/review-tabs";
import { AttemptSource } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";
import type { ReviewPage } from "@/server/queries/progress";

/**
 * The questions behind a tab: their text only. Options, the correct answer and the
 * explanation are never loaded here — they belong to a practice attempt, where the
 * answer is revealed after the user has committed to one.
 */
export function ReviewQuestionList({ page, emptyText }: { page: ReviewPage; emptyText: string }) {
  if (page.items.length === 0) {
    return <EmptyState icon={CircleCheckIcon} title={emptyText} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {page.items.map((question) => (
          <li key={question.id}>
            <Card size="sm">
              <CardContent className="flex flex-wrap items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="reading-sm measure font-serif">{question.text}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {question.subjectName} · №{question.code}
                    {question.wrongCount !== null && question.wrongCount > 0 && (
                      <> · {question.wrongCount} удаа алдсан</>
                    )}
                    {question.nextReviewAt && (
                      <>
                        {" · "}
                        <time dateTime={question.nextReviewAt.toISOString()}>
                          {formatDateTime(question.nextReviewAt)}
                        </time>
                        {" -нд давтах"}
                      </>
                    )}
                    {question.bookmarkedAt && (
                      <>
                        {" · "}
                        <time dateTime={question.bookmarkedAt.toISOString()}>
                          {formatDateTime(question.bookmarkedAt)}
                        </time>
                      </>
                    )}
                  </p>
                </div>
                {page.tab === AttemptSource.BOOKMARKED && (
                  <RemoveBookmarkButton questionId={question.id} />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && <ReviewPagination page={page} />}
    </div>
  );
}

function ReviewPagination({ page }: { page: ReviewPage }) {
  const linkClass = cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9");
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <nav aria-label="Хуудаслалт" className="flex items-center justify-between gap-3">
      <Link
        href={reviewHref(page.tab, page.page - 1)}
        aria-disabled={page.page === 1 || undefined}
        tabIndex={page.page === 1 ? -1 : undefined}
        className={cn(linkClass, page.page === 1 && disabledClass)}
      >
        Өмнөх
      </Link>
      <p className="text-xs text-muted-foreground tabular-nums">
        {page.page} / {page.pageCount} хуудас · нийт {page.total} асуулт
      </p>
      <Link
        href={reviewHref(page.tab, page.page + 1)}
        aria-disabled={page.page === page.pageCount || undefined}
        tabIndex={page.page === page.pageCount ? -1 : undefined}
        className={cn(linkClass, page.page === page.pageCount && disabledClass)}
      >
        Дараах
      </Link>
    </nav>
  );
}
