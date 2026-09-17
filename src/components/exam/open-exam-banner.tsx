import Link from "next/link";
import { ClockIcon } from "lucide-react";
import { cn } from "cn";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export type OpenExam = {
  id: string;
  presetName: string | null;
  deadline: Date | null;
  totalCount: number;
  answeredCount: number;
};

/**
 * The "you have an exam running" banner, shown wherever the user's attempts are
 * listed. The page must call finalizeMyExpiredExam() before reading the exam, so a
 * finished one is never announced as open.
 */
export function OpenExamBanner({ exam }: { exam: OpenExam }) {
  return (
    <Card className="ring-warning/50">
      <CardContent className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-semibold">Үргэлжилж буй шалгалт</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {exam.presetName ?? "Шалгалт"} · Хариулсан {exam.answeredCount} / {exam.totalCount}
          </p>
          {exam.deadline && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ClockIcon className="size-3.5" aria-hidden="true" />
              {formatDateTime(exam.deadline)} хүртэл
            </p>
          )}
        </div>
        <Link
          href={`/exam/${exam.id}`}
          className={cn(buttonVariants(), "h-11 w-full sm:h-9 sm:w-auto")}
        >
          Үргэлжлүүлэх
        </Link>
      </CardContent>
    </Card>
  );
}
