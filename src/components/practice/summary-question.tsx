"use client";

import { useState } from "react";
import { QuestionCard } from "@/components/quiz/question-card";
import { ReportQuestionDialog } from "@/components/quiz/report-question-dialog";
import { useBookmark } from "@/components/practice/use-bookmark";
import { reportQuestion } from "@/server/actions/practice";
import type { PlayerItem } from "@/server/queries/player-item";

/**
 * A revealed item (practice summary, exam result), in the option order the user saw,
 * bookmarkable and, optionally, reportable.
 */
export function SummaryQuestion({
  item,
  total,
  reportable = false,
}: {
  item: PlayerItem;
  total: number;
  reportable?: boolean;
}) {
  const bookmark = useBookmark(item.questionId, item.bookmarked);
  const [reportOpen, setReportOpen] = useState(false);
  if (!item.result) return null;

  return (
    <div className="flex flex-col gap-2">
      <QuestionCard
        mode="practice"
        position={item.position}
        total={total}
        subject={item.subjectName}
        text={item.text}
        imageUrl={item.imageUrl}
        options={item.options}
        selectedOptionId={item.selectedOptionId}
        correctOptionId={item.result.correctOptionId}
        explanation={item.result.explanation}
        bookmarked={bookmark.bookmarked}
        bookmarkPending={bookmark.pending}
        onToggleBookmark={bookmark.toggle}
      />
      {reportable && (
        <div className="self-end">
          <ReportQuestionDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            onSubmit={(message) => reportQuestion({ questionId: item.questionId, message })}
          />
        </div>
      )}
    </div>
  );
}
