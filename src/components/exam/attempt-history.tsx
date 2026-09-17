import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AttemptStatus } from "@/generated/prisma/enums";
import { formatDateTime } from "@/lib/format";

export type AttemptHistoryRow = {
  id: string;
  href: string;
  title: string;
  status: AttemptStatus;
  startedAt: Date;
  correctCount: number;
  totalCount: number;
};

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
                  <span className="truncate">{row.title}</span>
                  {row.status === AttemptStatus.EXPIRED ? (
                    <Badge variant="outline" className="border-warning text-warning">
                      Хугацаа дууссан
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Дууссан</Badge>
                  )}
                </span>
                <time dateTime={row.startedAt.toISOString()} className="text-xs text-muted-foreground">
                  {formatDateTime(row.startedAt)}
                </time>
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
