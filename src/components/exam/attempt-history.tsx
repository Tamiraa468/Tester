import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { AttemptMode, AttemptStatus, type AttemptSource } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type AttemptHistoryRow = {
  id: string;
  href: string;
  mode: AttemptMode;
  /** Practice only: what the attempt was drawn from. */
  source: AttemptSource | null;
  /** Exam only. */
  presetName: string | null;
  subjectName?: string | null;
  status: AttemptStatus;
  startedAt: Date;
  correctCount: number;
  totalCount: number;
};

/** An exam is named after its preset, a practice after the source it was drawn from. */
export function attemptTitle(row: Pick<AttemptHistoryRow, "mode" | "source" | "presetName">): string {
  if (row.mode === AttemptMode.EXAM) return row.presetName ?? "Шалгалт";
  return row.source ? SOURCE_LABELS[row.source].label : "Дадлага";
}

/** A user's finished attempts, newest first, each linking to its result. */
export function AttemptHistory({
  rows,
  emptyText,
}: {
  rows: readonly AttemptHistoryRow[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  // Only a mixed list (the dashboard) has to say which mode a row is; on /exam or a
  // practice-only list the title already says it.
  const mixedModes = new Set(rows.map((row) => row.mode)).size > 1;

  return (
    <ul className="flex flex-col divide-y rounded-xl border">
      {rows.map((row) => {
        const percent = row.totalCount === 0 ? 0 : Math.round((row.correctCount / row.totalCount) * 100);
        return (
          <li key={row.id}>
            <Link
              href={row.href}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="truncate">{attemptTitle(row)}</span>
                  {mixedModes && (
                    <Badge variant="outline">
                      {row.mode === AttemptMode.EXAM ? "Шалгалт" : "Дадлага"}
                    </Badge>
                  )}
                  {row.status === AttemptStatus.EXPIRED ? (
                    <Badge variant="outline" className="border-warning text-warning">
                      Хугацаа дууссан
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Дууссан</Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.subjectName && <>{row.subjectName} · </>}
                  <time dateTime={row.startedAt.toISOString()}>{formatDateTime(row.startedAt)}</time>
                </span>
              </div>
              <span className="text-right text-sm tabular-nums">
                <span className="font-semibold">
                  {row.correctCount}/{row.totalCount}
                </span>
                <span className="block text-xs text-muted-foreground">{percent}%</span>
              </span>
              <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Дүн харах</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
