// Shared types for the question bank import pipeline (read -> parse -> validate -> commit).
// Nothing here depends on Next.js, so the admin panel can reuse the whole pipeline.

export const HEADERS = [
  "code",
  "subject",
  "question",
  "option_1",
  "option_2",
  "option_3",
  "option_4",
  "option_5",
  "option_6",
  "correct",
  "pinned",
  "lock",
  "explanation",
  "image_url",
] as const;

export type Header = (typeof HEADERS)[number];

// Option columns are referenced by their 1-based position in the template
// (option_1 .. option_6), which is what the "correct" and "pinned" columns point at.
export const OPTION_COLUMN_COUNT = 6;

/** One spreadsheet row, every cell already turned into a string. */
export type RawRow = {
  /** 1-based row number in the sheet, so messages match what the user sees. */
  rowNumber: number;
  cells: Record<Header, string>;
};

export type OptionInput = {
  text: string;
  isCorrect: boolean;
  /** Pinned options always stay last, even when the rest are shuffled. */
  pinned: boolean;
  /** 0-based position among the non-empty options. */
  sortOrder: number;
};

export type QuestionInput = {
  rowNumber: number;
  code: string;
  subjectName: string;
  text: string;
  options: OptionInput[];
  lockOptions: boolean;
  explanation?: string;
  imageUrl?: string;
};

/** A single problem found in one row. `message` is user-facing, so Mongolian. */
export type Issue = {
  rowNumber: number;
  code?: string;
  message: string;
};

/**
 * A reference from the "correct" / "pinned" columns to an option column.
 * Unresolved references stay unresolved: guessing an answer would be worse than failing.
 */
export type ColumnRef =
  | { kind: "column"; column: number }
  | { kind: "ambiguous"; raw: string };

export type CorrectRef = ColumnRef | { kind: "missing" };

/**
 * Parse output. The `QuestionInput` part is exactly what `commit` consumes; the extra
 * fields carry what `validate` needs to explain a bad reference.
 */
export type ParsedRow = QuestionInput & {
  correctRef: CorrectRef;
  pinnedRefs: ColumnRef[];
  /** Original 1-based option column of each kept option, same order as `options`. */
  optionColumns: number[];
};

export type ParseResult = {
  rows: ParsedRow[];
  warnings: Issue[];
};

export type ValidationResult = {
  valid: QuestionInput[];
  errors: Issue[];
  warnings: Issue[];
};

export type CommitStatus = "created" | "updated" | "unchanged" | "skipped";

export type CommitNote = {
  rowNumber: number;
  code: string;
  status: CommitStatus;
  message?: string;
};

export type CommitResult = {
  created: number;
  updated: number;
  unchanged: number;
  /** Rows that could not be applied in full (e.g. surplus options kept because attempts exist). */
  skipped: number;
  notes: CommitNote[];
  warnings: Issue[];
};
