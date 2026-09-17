import "server-only";
import type { ExportQuestion } from "@/lib/import/export";
import { db } from "@/lib/db";

/** Questions fetched per round trip while the workbook streams out. */
export const EXPORT_PAGE_SIZE = 500;

const questionSelect = {
  code: true,
  text: true,
  explanation: true,
  imageUrl: true,
  lockOptions: true,
  isActive: true,
  subject: { select: { name: true } },
  options: {
    orderBy: { sortOrder: "asc" },
    select: { text: true, isCorrect: true, pinned: true, sortOrder: true },
  },
} as const;

type Row = {
  code: string;
  text: string;
  explanation: string | null;
  imageUrl: string | null;
  lockOptions: boolean;
  isActive: boolean;
  subject: { name: string };
  options: { text: string; isCorrect: boolean; pinned: boolean; sortOrder: number }[];
};

const toExportQuestion = (row: Row): ExportQuestion => ({
  code: row.code,
  subjectName: row.subject.name,
  text: row.text,
  explanation: row.explanation,
  imageUrl: row.imageUrl,
  lockOptions: row.lockOptions,
  isActive: row.isActive,
  options: row.options,
});

export function countQuestionsForExport(): Promise<number> {
  return db.question.count();
}

/**
 * The whole bank, INCLUDING inactive questions, ordered by code and fetched a page at a
 * time so the export never holds it all in memory. Question.code is unique, so it is
 * also the cursor.
 */
export async function* iterateQuestionsForExport(): AsyncGenerator<ExportQuestion> {
  let cursor: string | undefined;

  for (;;) {
    const rows = (await db.question.findMany({
      take: EXPORT_PAGE_SIZE,
      ...(cursor === undefined ? {} : { skip: 1, cursor: { code: cursor } }),
      orderBy: { code: "asc" },
      select: questionSelect,
    })) as Row[];

    if (rows.length === 0) return;
    for (const row of rows) yield toExportQuestion(row);
    if (rows.length < EXPORT_PAGE_SIZE) return;
    cursor = rows[rows.length - 1].code;
  }
}
