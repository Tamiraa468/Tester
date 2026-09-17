import { describe, expect, it } from "vitest";
import { exportFileName, templateRowValues, toTemplateRow, type ExportQuestion } from "./export";
import { parseRows } from "./parse";
import { HEADERS } from "./types";
import { validate } from "./validate";

const question = (overrides: Partial<ExportQuestion> = {}): ExportQuestion => ({
  code: "ARG-001",
  subjectName: "Судалгааны арга зүй",
  text: "Таамаглал гэж юу вэ?",
  explanation: "Тайлбар",
  imageUrl: null,
  lockOptions: false,
  isActive: true,
  options: [
    { text: "Нэг", isCorrect: false, pinned: false, sortOrder: 0 },
    { text: "Хоёр", isCorrect: true, pinned: false, sortOrder: 1 },
    { text: "Гурав", isCorrect: false, pinned: false, sortOrder: 2 },
  ],
  ...overrides,
});

/** Feeds a row straight back through the reader's parse + validate steps. */
function reimport(rows: ReturnType<typeof toTemplateRow>[]) {
  const raw = rows.map((cells, index) => ({ rowNumber: index + 2, cells }));
  const parsed = parseRows(raw);
  return { parsed, result: validate(parsed.rows) };
}

describe("toTemplateRow", () => {
  it("writes the correct answer as a letter, not a column number", () => {
    expect(toTemplateRow(question()).correct).toBe("b");
    const firstCorrect = question({
      options: [
        { text: "Нэг", isCorrect: true, pinned: false, sortOrder: 0 },
        { text: "Хоёр", isCorrect: false, pinned: false, sortOrder: 1 },
      ],
    });
    expect(toTemplateRow(firstCorrect).correct).toBe("a");
  });

  it("writes pinned options as letters, comma separated", () => {
    const row = toTemplateRow(
      question({
        options: [
          { text: "Нэг", isCorrect: true, pinned: false, sortOrder: 0 },
          { text: "Аль нь ч биш", isCorrect: false, pinned: true, sortOrder: 1 },
          { text: "Бүгд зөв", isCorrect: false, pinned: true, sortOrder: 2 },
        ],
      }),
    );
    expect(row.pinned).toBe("b,c");
  });

  it("writes the active flag and the lock", () => {
    expect(toTemplateRow(question()).active).toBe("1");
    expect(toTemplateRow(question({ isActive: false })).active).toBe("0");
    expect(toTemplateRow(question()).lock).toBe("");
    expect(toTemplateRow(question({ lockOptions: true })).lock).toBe("1");
  });

  it("compacts options into option_1.. by sortOrder, whatever order they arrive in", () => {
    const row = toTemplateRow(
      question({
        options: [
          { text: "Гурав", isCorrect: true, pinned: false, sortOrder: 2 },
          { text: "Нэг", isCorrect: false, pinned: false, sortOrder: 0 },
          { text: "Хоёр", isCorrect: false, pinned: false, sortOrder: 1 },
        ],
      }),
    );
    expect([row.option_1, row.option_2, row.option_3]).toEqual(["Нэг", "Хоёр", "Гурав"]);
    expect(row.correct).toBe("c");
    expect(row.option_4).toBe("");
  });

  it("writes every cell as a string, including text that looks like a formula", () => {
    const row = toTemplateRow(question({ text: "=SUM(A1:A2) илэрхийлэл юу вэ?" }));
    for (const value of templateRowValues(row)) {
      expect(typeof value).toBe("string");
    }
    expect(row.question).toBe("=SUM(A1:A2) илэрхийлэл юу вэ?");
    expect(templateRowValues(row)).toHaveLength(HEADERS.length);
  });

  it("survives parse + validate unchanged, which is what a re-import does", () => {
    const rows = [
      toTemplateRow(question()),
      toTemplateRow(
        question({
          code: "ARG-002",
          isActive: false,
          lockOptions: true,
          imageUrl: "https://example.mn/a.png",
          explanation: null,
          options: [
            { text: "Нэг", isCorrect: false, pinned: false, sortOrder: 0 },
            { text: "Хоёр", isCorrect: false, pinned: false, sortOrder: 1 },
            { text: "Бүгд зөв", isCorrect: true, pinned: true, sortOrder: 2 },
          ],
        }),
      ),
    ];

    const { result } = reimport(rows);
    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(2);

    expect(result.valid[0]).toMatchObject({
      code: "ARG-001",
      subjectName: "Судалгааны арга зүй",
      isActive: true,
      lockOptions: false,
      explanation: "Тайлбар",
    });
    expect(result.valid[0].options.map((option) => [option.text, option.isCorrect, option.pinned])).toEqual([
      ["Нэг", false, false],
      ["Хоёр", true, false],
      ["Гурав", false, false],
    ]);

    expect(result.valid[1]).toMatchObject({
      isActive: false,
      lockOptions: true,
      imageUrl: "https://example.mn/a.png",
    });
    expect(result.valid[1].explanation).toBeUndefined();
    expect(result.valid[1].options[2]).toMatchObject({ text: "Бүгд зөв", isCorrect: true, pinned: true });
  });

  it("does not let an exported label be mistaken for option numbering", () => {
    // "a. …", "b. …" in sequence would normally be stripped as labels on import.
    const rows = [
      toTemplateRow(
        question({
          options: [
            { text: "a. Нэг", isCorrect: true, pinned: false, sortOrder: 0 },
            { text: "b. Хоёр", isCorrect: false, pinned: false, sortOrder: 1 },
          ],
        }),
      ),
    ];
    const { parsed } = reimport(rows);
    // The stripping is reported, so an operator can see it happened.
    expect(parsed.warnings.map((warning) => warning.message).join(" ")).toContain("дугаарлалт");
  });
});

describe("exportFileName", () => {
  it("carries the date", () => {
    expect(exportFileName(new Date("2026-09-17T10:00:00.000Z"))).toBe("question-bank-2026-09-17.xlsx");
  });
});
