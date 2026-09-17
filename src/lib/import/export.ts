// Question bank -> template rows. Pure: no ExcelJS, no database, so the round trip
// (export a bank, import it again, every row unchanged) can be reasoned about and
// tested on its own.
//
// correct and pinned are written as LETTERS (a-f), the way the printed book and the
// pilot file spell them; parse.ts accepts both letters and column numbers.

import { HEADERS, OPTION_COLUMN_COUNT, type Header } from "./types";

export const EXPORT_LETTERS = ["a", "b", "c", "d", "e", "f"] as const;

export type ExportOption = {
  text: string;
  isCorrect: boolean;
  pinned: boolean;
  sortOrder: number;
};

export type ExportQuestion = {
  code: string;
  subjectName: string;
  text: string;
  explanation: string | null;
  imageUrl: string | null;
  lockOptions: boolean;
  isActive: boolean;
  options: ExportOption[];
};

export type TemplateRow = Record<Header, string>;

/** The letter of a display position, or "" when it is out of range. */
export function letterForPosition(index: number): string {
  return EXPORT_LETTERS[index] ?? "";
}

const emptyRow = (): TemplateRow =>
  Object.fromEntries(HEADERS.map((header) => [header, ""])) as TemplateRow;

/**
 * One spreadsheet row. Options are written into option_1..option_N in sortOrder with no
 * gaps, so the letters the correct/pinned columns carry are the positions a reader sees.
 * Options past the sixth cannot be represented and are dropped, which the caller is
 * expected to have made impossible (the editor and the import both cap at six).
 */
export function toTemplateRow(question: ExportQuestion): TemplateRow {
  const options = [...question.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, OPTION_COLUMN_COUNT);

  const row = emptyRow();
  row.code = question.code;
  row.subject = question.subjectName;
  row.question = question.text;
  row.explanation = question.explanation ?? "";
  row.image_url = question.imageUrl ?? "";
  row.lock = question.lockOptions ? "1" : "";
  row.active = question.isActive ? "1" : "0";

  options.forEach((option, index) => {
    row[`option_${index + 1}` as Header] = option.text;
  });

  const correct = options.findIndex((option) => option.isCorrect);
  row.correct = correct === -1 ? "" : letterForPosition(correct);
  row.pinned = options
    .map((option, index) => (option.pinned ? letterForPosition(index) : ""))
    .filter((letter) => letter !== "")
    .join(",");

  return row;
}

export function toTemplateRows(questions: readonly ExportQuestion[]): TemplateRow[] {
  return questions.map(toTemplateRow);
}

/** The row's cells in header order, ready to be written as plain strings. */
export function templateRowValues(row: TemplateRow): string[] {
  return HEADERS.map((header) => row[header]);
}

/** "asuultyn-san-2026-09-17.xlsx" */
export function exportFileName(today: Date): string {
  return `question-bank-${today.toISOString().slice(0, 10)}.xlsx`;
}
