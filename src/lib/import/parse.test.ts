import { describe, expect, it } from "vitest";
import { normalizeText, parseRows, resolveColumnRef, stripSequentialLabels } from "./parse";
import { HEADERS, type Header, type RawRow } from "./types";

function rawRow(values: Partial<Record<Header, string>>, rowNumber = 2): RawRow {
  const cells = Object.fromEntries(HEADERS.map((header) => [header, ""])) as Record<Header, string>;
  return { rowNumber, cells: { ...cells, ...values } };
}

const base = {
  code: "Q-1",
  subject: "Нийтийн эрх зүй",
  question: "Асуулт?",
  option_1: "Нэг",
  option_2: "Хоёр",
  option_3: "Гурав",
  option_4: "Дөрөв",
};

function parseOne(values: Partial<Record<Header, string>>) {
  const { rows, warnings } = parseRows([rawRow({ ...base, ...values })]);
  return { row: rows[0], warnings };
}

describe("normalizeText", () => {
  it("applies NFC, collapses repeated spaces and trims", () => {
    expect(normalizeText("  Нэг     хоёр \n гурав  ")).toBe("Нэг хоёр гурав");
  });

  it("normalizes decomposed Cyrillic to the composed form", () => {
    expect(normalizeText("й")).toBe("й");
  });
});

describe("resolveColumnRef", () => {
  it("accepts numbers 1-6", () => {
    expect(resolveColumnRef("3")).toEqual({ kind: "column", column: 3 });
  });

  it("accepts Latin letters in any case", () => {
    expect(resolveColumnRef("a")).toEqual({ kind: "column", column: 1 });
    expect(resolveColumnRef("F")).toEqual({ kind: "column", column: 6 });
  });

  it("treats the Cyrillic look-alikes а, с, е as Latin a, c, e", () => {
    expect(resolveColumnRef("а")).toEqual({ kind: "column", column: 1 });
    expect(resolveColumnRef("с")).toEqual({ kind: "column", column: 3 });
    expect(resolveColumnRef("е")).toEqual({ kind: "column", column: 5 });
  });

  it("rejects every other Cyrillic letter as ambiguous", () => {
    for (const letter of ["б", "в", "г", "д", "ө"]) {
      expect(resolveColumnRef(letter)).toEqual({ kind: "ambiguous", raw: letter });
    }
  });

  it("rejects out-of-range numbers and multi-character tokens", () => {
    expect(resolveColumnRef("7")).toEqual({ kind: "ambiguous", raw: "7" });
    expect(resolveColumnRef("ab")).toEqual({ kind: "ambiguous", raw: "ab" });
  });

  it("returns null for an empty cell", () => {
    expect(resolveColumnRef("   ")).toBeNull();
  });
});

describe("stripSequentialLabels", () => {
  it("strips Latin, Cyrillic and numeric labels", () => {
    expect(stripSequentialLabels(["a. Нэг", "b. Хоёр", "c. Гурав"])).toEqual([
      "Нэг",
      "Хоёр",
      "Гурав",
    ]);
    expect(stripSequentialLabels(["а) Нэг", "б) Хоёр"])).toEqual(["Нэг", "Хоёр"]);
    expect(stripSequentialLabels(["1. Нэг", "2. Хоёр"])).toEqual(["Нэг", "Хоёр"]);
  });

  it("leaves the row alone when the labels are not sequential", () => {
    expect(stripSequentialLabels(["a. Нэг", "c. Хоёр"])).toBeNull();
  });

  it("leaves the row alone when only some options are labelled", () => {
    expect(stripSequentialLabels(["a. Нэг", "Хоёр"])).toBeNull();
  });

  it("never touches letters inside words", () => {
    expect(stripSequentialLabels(["Аварга шалгаруулах", "Бүгд зөв"])).toBeNull();
  });
});

describe("parseRows", () => {
  it("builds a QuestionInput with 0-based sortOrder", () => {
    const { row } = parseOne({ correct: "2" });
    expect(row.code).toBe("Q-1");
    expect(row.subjectName).toBe("Нийтийн эрх зүй");
    expect(row.options.map((option) => option.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(row.options.map((option) => option.isCorrect)).toEqual([false, true, false, false]);
  });

  it("resolves a letter answer", () => {
    const { row } = parseOne({ correct: "D" });
    expect(row.options[3].isCorrect).toBe(true);
  });

  it("resolves a Cyrillic look-alike answer", () => {
    const { row } = parseOne({ correct: "с" });
    expect(row.options[2].isCorrect).toBe(true);
  });

  it("keeps an ambiguous answer unresolved instead of guessing", () => {
    const { row } = parseOne({ correct: "б" });
    expect(row.correctRef).toEqual({ kind: "ambiguous", raw: "б" });
    expect(row.options.some((option) => option.isCorrect)).toBe(false);
  });

  it("reports a missing answer as missing", () => {
    const { row } = parseOne({ correct: "" });
    expect(row.correctRef).toEqual({ kind: "missing" });
  });

  it("ignores empty option cells but keeps the original column references", () => {
    const { row } = parseOne({
      option_2: "",
      option_3: "Гурав",
      option_4: "",
      correct: "c",
    });
    expect(row.options.map((option) => option.text)).toEqual(["Нэг", "Гурав"]);
    expect(row.optionColumns).toEqual([1, 3]);
    expect(row.options[1]).toMatchObject({ text: "Гурав", isCorrect: true, sortOrder: 1 });
  });

  it("parses comma separated pinned references", () => {
    const { row } = parseOne({ correct: "a", pinned: "d, 3" });
    expect(row.options.map((option) => option.pinned)).toEqual([false, false, true, true]);
  });

  it("parses lock", () => {
    expect(parseOne({ correct: "a", lock: "1" }).row.lockOptions).toBe(true);
    expect(parseOne({ correct: "a", lock: "true" }).row.lockOptions).toBe(true);
    expect(parseOne({ correct: "a", lock: "" }).row.lockOptions).toBe(false);
  });

  it("strips sequential labels and warns once for the row", () => {
    const { row, warnings } = parseOne({
      option_1: "a. Нэг",
      option_2: "b. Хоёр",
      option_3: "c. Гурав",
      option_4: "d. Дөрөв",
      correct: "d",
    });
    expect(row.options.map((option) => option.text)).toEqual(["Нэг", "Хоёр", "Гурав", "Дөрөв"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ rowNumber: 2, code: "Q-1" });
  });

  it("does not warn when there are no labels", () => {
    expect(parseOne({ correct: "a" }).warnings).toEqual([]);
  });

  it("omits explanation and imageUrl when their cells are empty", () => {
    const { row } = parseOne({ correct: "a" });
    expect(row.explanation).toBeUndefined();
    expect(row.imageUrl).toBeUndefined();
  });

  it("keeps explanation and imageUrl when present", () => {
    const { row } = parseOne({
      correct: "a",
      explanation: "  Тайлбар  ",
      image_url: "https://example.test/a.png",
    });
    expect(row.explanation).toBe("Тайлбар");
    expect(row.imageUrl).toBe("https://example.test/a.png");
  });
});
