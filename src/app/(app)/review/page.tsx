import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { Card, CardContent } from "@/components/ui/card";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { StartPracticeButton } from "@/components/practice/start-practice-button";
import { ReviewQuestionList } from "@/components/review/review-question-list";
import { parseReviewTab, REVIEW_TAB_LABELS, ReviewTabs } from "@/components/review/review-tabs";
import { AttemptSource } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { finalizeMyExpiredExam } from "@/server/actions/exam";
import { getReviewCounts, listReviewQuestions } from "@/server/queries/progress";

export const metadata: Metadata = { title: "Давтах" };

const EMPTY_TEXT: Record<ReturnType<typeof parseReviewTab>, string> = {
  [AttemptSource.DUE]: "Одоогоор давтах хугацаа болсон асуулт алга. Сайн байна!",
  [AttemptSource.WRONG]: "Алдсан асуулт алга байна.",
  [AttemptSource.BOOKMARKED]: "Та одоогоор асуулт тэмдэглээгүй байна.",
};

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  await auth.protect();
  const user = await requireUser();
  // Reads the user's progress, so an expired open exam is graded first.
  await finalizeMyExpiredExam();

  const { tab: tabParam, page: pageParam } = await searchParams;
  const tab = parseReviewTab(typeof tabParam === "string" ? tabParam : undefined);
  // listReviewQuestions clamps the page to the ones that exist.
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const page = Number.isFinite(requested) ? requested : 1;

  const [counts, questions] = await Promise.all([
    getReviewCounts(user.id),
    listReviewQuestions(user.id, tab, page),
  ]);
  const available = counts[tab];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Давтах</h1>
        <p className="text-sm text-muted-foreground">
          Давтах хугацаа болсон, алдсан болон тэмдэглэсэн асуултууд.
        </p>
      </div>

      <ReviewTabs current={tab} counts={counts} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="font-semibold tabular-nums">
              {REVIEW_TAB_LABELS[tab]}: {available} асуулт
            </p>
            <p className="text-sm text-muted-foreground">{SOURCE_LABELS[tab].description}</p>
          </div>
          <StartPracticeButton
            source={tab}
            available={available}
            className="h-11 w-full sm:h-9 sm:w-auto"
          >
            Дадлага эхлэх
          </StartPracticeButton>
        </CardContent>
      </Card>

      <section aria-label={`${REVIEW_TAB_LABELS[tab]} асуултууд`}>
        <ReviewQuestionList page={questions} emptyText={EMPTY_TEXT[tab]} />
      </section>
    </div>
  );
}
