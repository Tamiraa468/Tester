import "server-only";
import { ReportStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export const REPORTS_PAGE_SIZE = 20;

export type AdminReport = {
  id: string;
  message: string;
  status: ReportStatus;
  createdAt: Date;
  question: {
    id: string;
    code: string;
    text: string;
    subjectName: string;
    isActive: boolean;
  };
};

export type AdminReportPage = {
  items: AdminReport[];
  total: number;
  open: number;
  page: number;
  pageCount: number;
};

/**
 * The report queue: OPEN first (the enum is declared OPEN, RESOLVED, so ascending is
 * the queue order), newest first within a status.
 */
export async function listReports(page = 1): Promise<AdminReportPage> {
  const [total, open] = await Promise.all([
    db.questionReport.count(),
    db.questionReport.count({ where: { status: ReportStatus.OPEN } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / REPORTS_PAGE_SIZE));
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount);

  const rows = await db.questionReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    skip: (current - 1) * REPORTS_PAGE_SIZE,
    take: REPORTS_PAGE_SIZE,
    select: {
      id: true,
      message: true,
      status: true,
      createdAt: true,
      question: {
        select: {
          id: true,
          code: true,
          text: true,
          isActive: true,
          subject: { select: { name: true } },
        },
      },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt,
      question: {
        id: row.question.id,
        code: row.question.code,
        text: row.question.text,
        subjectName: row.question.subject.name,
        isActive: row.question.isActive,
      },
    })),
    total,
    open,
    page: current,
    pageCount,
  };
}
