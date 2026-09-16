// ParsedRow[] -> { valid, errors, warnings }.
// Errors block the whole import; warnings are reported but let the row through.

import type { Issue, ParsedRow, QuestionInput, ValidationResult } from "./types";

// "Бүгд зөв" style options must be pinned, otherwise shuffling can move them off the end.
const ALL_OR_NONE_PATTERNS = [
  /бүгд\s+зөв/,
  /бүгд\s+буруу/,
  /бүх\s+хувилбар/,
  /аль\s+нь\s+ч\s+биш/,
  /дээрх\s+бүгд/,
  /дээрхийн\s+аль/,
  /хариулт\s+байхгүй/,
];

export function looksLikeAllOrNone(text: string): boolean {
  const normalized = text.toLowerCase();
  return ALL_OR_NONE_PATTERNS.some((pattern) => pattern.test(normalized));
}

// Standalone single letters/digits in an option text ("А ба В зөв", "a ба b", "1 ба 3")
// mean the option refers to its siblings, so the order must be locked.
const REFERENCE_TOKEN = /^[a-fA-FА-ЕаАбБвВгГдДеЕ1-6]$/;

export function referencesOtherOptions(text: string): boolean {
  const tokens = text.split(/[\s,;/&()]+/).filter((token) => token !== "");
  const singles = tokens.filter((token) => [...token].length === 1 && REFERENCE_TOKEN.test(token));
  return singles.length >= 2;
}

/** Words that mix Latin and Cyrillic letters are usually a transcription slip. */
export function mixedScriptWords(text: string): string[] {
  return text
    .split(/[^\p{L}]+/u)
    .filter((word) => word !== "" && /\p{Script=Latin}/u.test(word) && /\p{Script=Cyrillic}/u.test(word));
}

export function validate(rows: ParsedRow[]): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const valid: QuestionInput[] = [];

  // Duplicate code / question text are file-wide checks, so collect positions first.
  const rowsByCode = new Map<string, number[]>();
  const rowsByText = new Map<string, number[]>();
  for (const row of rows) {
    if (row.code !== "") {
      rowsByCode.set(row.code, [...(rowsByCode.get(row.code) ?? []), row.rowNumber]);
    }
    if (row.text !== "") {
      const key = row.text.toLowerCase();
      rowsByText.set(key, [...(rowsByText.get(key) ?? []), row.rowNumber]);
    }
  }

  for (const row of rows) {
    const where = { rowNumber: row.rowNumber, code: row.code || undefined };
    const rowErrors: Issue[] = [];

    if (row.code === "") rowErrors.push({ ...where, message: "code (асуултын код) хоосон байна." });
    if (row.subjectName === "") {
      rowErrors.push({ ...where, message: "subject (бүлэг) хоосон байна." });
    }
    if (row.text === "") {
      rowErrors.push({ ...where, message: "question (асуултын текст) хоосон байна." });
    }
    if (row.options.length < 2) {
      rowErrors.push({
        ...where,
        message: `Хувилбар хоёроос бага байна (${row.options.length}).`,
      });
    }

    switch (row.correctRef.kind) {
      case "missing":
        rowErrors.push({ ...where, message: "correct (зөв хариулт) хоосон байна." });
        break;
      case "ambiguous":
        rowErrors.push({
          ...where,
          message:
            `correct багана дахь "${row.correctRef.raw}" эргэлзээтэй. ` +
            "Зөвхөн 1-6 тоо эсвэл латин a-f үсэг бичнэ.",
        });
        break;
      case "column":
        if (!row.optionColumns.includes(row.correctRef.column)) {
          rowErrors.push({
            ...where,
            message: `correct нь хоосон option_${row.correctRef.column} багана дээр чиглэж байна.`,
          });
        }
        break;
    }

    for (const ref of row.pinnedRefs) {
      if (ref.kind === "ambiguous") {
        rowErrors.push({
          ...where,
          message:
            `pinned багана дахь "${ref.raw}" эргэлзээтэй. ` +
            "Зөвхөн 1-6 тоо эсвэл латин a-f үсэг бичнэ.",
        });
      } else if (!row.optionColumns.includes(ref.column)) {
        rowErrors.push({
          ...where,
          message: `pinned нь хоосон option_${ref.column} багана дээр чиглэж байна.`,
        });
      }
    }

    const duplicateCodeRows = row.code === "" ? [] : (rowsByCode.get(row.code) ?? []);
    if (duplicateCodeRows.length > 1) {
      rowErrors.push({
        ...where,
        message: `code "${row.code}" файлд давхардсан (мөр ${duplicateCodeRows.join(", ")}).`,
      });
    }

    // Warnings: reported for every row, including rows that already failed.
    const duplicateTextRows = (rowsByText.get(row.text.toLowerCase()) ?? []).filter(
      (rowNumber) => rowNumber !== row.rowNumber,
    );
    if (row.text !== "" && duplicateTextRows.length > 0) {
      warnings.push({
        ...where,
        message: `Асуултын текст ${duplicateTextRows.join(", ")}-р мөртэй давхардаж байна.`,
      });
    }

    const seenOptionTexts = new Set<string>();
    for (const option of row.options) {
      const key = option.text.toLowerCase();
      if (seenOptionTexts.has(key)) {
        warnings.push({ ...where, message: `"${option.text}" хувилбар давхардсан.` });
      }
      seenOptionTexts.add(key);

      if (looksLikeAllOrNone(option.text) && !option.pinned) {
        warnings.push({
          ...where,
          message: `"${option.text}" хувилбар "Бүгд зөв" төрлийн боловч pinned-д заагаагүй.`,
        });
      }

      if (referencesOtherOptions(option.text) && !row.lockOptions) {
        warnings.push({
          ...where,
          message:
            `"${option.text}" хувилбар бусад хувилбарыг үсэг/дугаараар иш татсан ` +
            "боловч lock тавиагүй.",
        });
      }
    }

    for (const word of mixedScriptWords(
      [row.subjectName, row.text, ...row.options.map((option) => option.text)].join(" "),
    )) {
      warnings.push({
        ...where,
        message: `"${word}" үгэнд латин ба кирилл үсэг хольсон байна.`,
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
    } else {
      // Only the QuestionInput part travels on to commit(); the reference fields were parse-only.
      valid.push({
        rowNumber: row.rowNumber,
        code: row.code,
        subjectName: row.subjectName,
        text: row.text,
        options: row.options,
        lockOptions: row.lockOptions,
        ...(row.explanation === undefined ? {} : { explanation: row.explanation }),
        ...(row.imageUrl === undefined ? {} : { imageUrl: row.imageUrl }),
      });
    }
  }

  return { valid, errors, warnings };
}
