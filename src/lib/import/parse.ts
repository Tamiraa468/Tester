// Raw spreadsheet rows -> ParsedRow[]. This step normalizes text and resolves the
// "correct" / "pinned" column references, but never decides whether a row is importable:
// that is validate.ts. An unresolvable answer stays unresolved instead of being guessed.

import {
  OPTION_COLUMN_COUNT,
  type ColumnRef,
  type CorrectRef,
  type Header,
  type Issue,
  type OptionInput,
  type ParseResult,
  type ParsedRow,
  type RawRow,
} from "./types";

/** NFC, no exotic spaces, no repeated whitespace. Letters inside words are never touched. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[  -‍  　﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Cyrillic letters that look exactly like their Latin counterparts are accepted as
// answer letters; every other Cyrillic letter (б в г д ...) is ambiguous by design.
const LOOKALIKE_TO_LATIN: Record<string, string> = { а: "a", с: "c", е: "e" };

const LETTER_TO_COLUMN: Record<string, number> = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 };

/** Resolves one "correct"/"pinned" token to a 1-based option column. */
export function resolveColumnRef(raw: string): ColumnRef | null {
  const token = normalizeText(raw).toLowerCase();
  if (token === "") return null;

  if (/^\d+$/.test(token)) {
    const column = Number(token);
    if (column >= 1 && column <= OPTION_COLUMN_COUNT) return { kind: "column", column };
    return { kind: "ambiguous", raw: normalizeText(raw) };
  }

  if ([...token].length === 1) {
    const letter = LOOKALIKE_TO_LATIN[token] ?? token;
    const column = LETTER_TO_COLUMN[letter];
    if (column) return { kind: "column", column };
  }

  return { kind: "ambiguous", raw: normalizeText(raw) };
}

function parseCorrect(raw: string): CorrectRef {
  return resolveColumnRef(raw) ?? { kind: "missing" };
}

function parsePinned(raw: string): ColumnRef[] {
  return normalizeText(raw)
    .split(",")
    .map((token) => resolveColumnRef(token))
    .filter((ref): ref is ColumnRef => ref !== null);
}

function parseLock(raw: string): boolean {
  const token = normalizeText(raw).toLowerCase();
  return token === "1" || token === "true" || token === "тийм";
}

// Label alphabets a row may be numbered with. Display letters are А Б В Г Д Е.
const LABEL_ALPHABETS = [
  ["a", "b", "c", "d", "e", "f"],
  ["A", "B", "C", "D", "E", "F"],
  ["а", "б", "в", "г", "д", "е"],
  ["А", "Б", "В", "Г", "Д", "Е"],
  ["1", "2", "3", "4", "5", "6"],
];

/**
 * Strips "a. ", "а) ", "1. " style labels, but only when every option in the row carries
 * the label it should have in sequence. A single mislabelled option leaves the row untouched.
 */
export function stripSequentialLabels(texts: string[]): string[] | null {
  if (texts.length < 2) return null;

  for (const alphabet of LABEL_ALPHABETS) {
    if (texts.length > alphabet.length) continue;

    const stripped: string[] = [];
    for (const [index, text] of texts.entries()) {
      const match = new RegExp(`^${alphabet[index]}\\s*[.)]\\s*(\\S.*)$`).exec(text);
      if (!match) break;
      stripped.push(match[1]);
    }
    if (stripped.length === texts.length) return stripped;
  }
  return null;
}

export function parseRows(raw: RawRow[]): ParseResult {
  const rows: ParsedRow[] = [];
  const warnings: Issue[] = [];

  for (const { rowNumber, cells } of raw) {
    const code = normalizeText(cells.code);
    const subjectName = normalizeText(cells.subject);
    const text = normalizeText(cells.question);

    // Empty option cells are ignored, but the surviving options remember the column
    // they came from, because "correct" and "pinned" refer to the original columns.
    const optionColumns: number[] = [];
    const optionTexts: string[] = [];
    for (let column = 1; column <= OPTION_COLUMN_COUNT; column++) {
      const value = normalizeText(cells[`option_${column}` as Header]);
      if (value === "") continue;
      optionColumns.push(column);
      optionTexts.push(value);
    }

    const stripped = stripSequentialLabels(optionTexts);
    if (stripped) {
      warnings.push({
        rowNumber,
        code: code || undefined,
        message: 'Хувилбар бүрийн "a." / "а)" / "1." мэтийн дугаарлалтыг автоматаар хассан.',
      });
    }
    const finalTexts = stripped ?? optionTexts;

    const correctRef = parseCorrect(cells.correct);
    const pinnedRefs = parsePinned(cells.pinned);
    const pinnedColumns = new Set(
      pinnedRefs.filter((ref) => ref.kind === "column").map((ref) => ref.column),
    );

    const options: OptionInput[] = finalTexts.map((optionText, index) => ({
      text: optionText,
      isCorrect: correctRef.kind === "column" && correctRef.column === optionColumns[index],
      pinned: pinnedColumns.has(optionColumns[index]),
      sortOrder: index,
    }));

    const explanation = normalizeText(cells.explanation);
    const imageUrl = normalizeText(cells.image_url);

    rows.push({
      rowNumber,
      code,
      subjectName,
      text,
      options,
      lockOptions: parseLock(cells.lock),
      ...(explanation === "" ? {} : { explanation }),
      ...(imageUrl === "" ? {} : { imageUrl }),
      correctRef,
      pinnedRefs,
      optionColumns,
    });
  }

  return { rows, warnings };
}
