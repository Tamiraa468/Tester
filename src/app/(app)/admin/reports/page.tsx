import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportStatusButton } from "@/components/admin/report-status-button";
import { ReportStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { listReports } from "@/server/queries/admin/reports";

export const metadata: Metadata = { title: "Ирсэн мэдээлэл" };

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await auth.protect();
  await requireAdmin();

  const { page: pageParam } = await searchParams;
  const requested = Number(typeof pageParam === "string" ? pageParam : 1);
  const reports = await listReports(Number.isFinite(requested) ? requested : 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Ирсэн мэдээлэл</h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          Шийдвэрлээгүй {reports.open} / нийт {reports.total}. Шийдвэрлээгүй нь эхэнд.
        </p>
      </div>

      {reports.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Одоогоор мэдээлэл алга.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.items.map((report) => (
            <li key={report.id}>
              <Card size="sm" className={cn(report.status === ReportStatus.OPEN && "ring-warning/40")}>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          {report.question.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {report.question.subjectName}
                        </span>
                        {report.status === ReportStatus.OPEN ? (
                          <Badge variant="outline" className="border-warning text-warning">
                            Шийдвэрлээгүй
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Шийдвэрлэсэн</Badge>
                        )}
                        {!report.question.isActive && <Badge variant="outline">Идэвхгүй</Badge>}
                      </span>
                      <p className="line-clamp-2 font-serif text-sm">{report.question.text}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/admin/questions/${report.question.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-9")}
                      >
                        Асуулт засах
                      </Link>
                      <ReportStatusButton reportId={report.id} status={report.status} />
                    </div>
                  </div>

                  <blockquote className="rounded-md border-l-2 bg-muted/40 px-3 py-2 text-sm">
                    {report.message}
                  </blockquote>
                  <time
                    dateTime={report.createdAt.toISOString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDateTime(report.createdAt)}
                  </time>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {reports.pageCount > 1 && (
        <nav aria-label="Хуудаслалт" className="flex items-center justify-between gap-3">
          <Link
            href={`/admin/reports?page=${reports.page - 1}`}
            aria-disabled={reports.page === 1 || undefined}
            tabIndex={reports.page === 1 ? -1 : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9",
              reports.page === 1 && "pointer-events-none opacity-50",
            )}
          >
            Өмнөх
          </Link>
          <p className="text-xs text-muted-foreground tabular-nums">
            {reports.page} / {reports.pageCount} хуудас
          </p>
          <Link
            href={`/admin/reports?page=${reports.page + 1}`}
            aria-disabled={reports.page === reports.pageCount || undefined}
            tabIndex={reports.page === reports.pageCount ? -1 : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9",
              reports.page === reports.pageCount && "pointer-events-none opacity-50",
            )}
          >
            Дараах
          </Link>
        </nav>
      )}
    </div>
  );
}
