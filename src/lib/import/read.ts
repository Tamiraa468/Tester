// Turns an .xlsx or .csv question bank file into RawRow[].
// Only the first worksheet of a workbook is read; other sheets (e.g. "Заавар") are ignored.

import { readFile as readFileFromDisk } from "node:fs/promises";
import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { HEADERS, type Header, type RawRow } from "./types";

type SheetRow = { rowNumber: number; cells: string[] };

/** ExcelJS cell values can be rich text, hyperlinks, formulas or errors. Flatten all of them. */
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    if (Array.isArray(object.richText)) {
      return object.richText.map((part) => cellToString((part as { text?: unknown }).text)).join("");
    }
    if ("text" in object) return cellToString(object.text);
    if ("result" in object) return cellToString(object.result);
    // Formula without a cached result, or an error cell: nothing usable.
    return "";
  }
  return String(value);
}

function rowCells(valueAt: (column: number) => unknown): string[] {
  const cells: string[] = [];
  for (let column = 1; column <= HEADERS.length; column++) {
    cells.push(cellToString(valueAt(column)));
  }
  return cells;
}

function assertHeaderRow(cells: string[]): void {
  HEADERS.forEach((expected, index) => {
    const actual = (cells[index] ?? "").normalize("NFC").trim().toLowerCase();
    if (actual !== expected) {
      throw new Error(
        `Толгой мөр таарахгүй: ${index + 1}-р багана "${cells[index] ?? ""}" байна, ` +
          `"${expected}" байх ёстой.`,
      );
    }
  });
}

function toRawRows(sheetRows: SheetRow[]): RawRow[] {
  const [header, ...body] = sheetRows;
  if (!header) throw new Error("Файл хоосон байна: толгой мөр олдсонгүй.");
  assertHeaderRow(header.cells);

  const rows: RawRow[] = [];
  for (const row of body) {
    if (row.cells.every((cell) => cell.trim() === "")) continue;
    const cells = {} as Record<Header, string>;
    HEADERS.forEach((name, index) => {
      cells[name] = row.cells[index] ?? "";
    });
    rows.push({ rowNumber: row.rowNumber, cells });
  }
  return rows;
}

async function readViaWorkbook(buffer: Buffer): Promise<SheetRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Файлд хуудас (worksheet) байхгүй.");

  const sheetRows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    sheetRows.push({ rowNumber, cells: rowCells((column) => row.getCell(column).value) });
  });
  return sheetRows;
}

async function readViaStream(buffer: Buffer): Promise<SheetRow[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    styles: "ignore",
  });

  const sheetRows: SheetRow[] = [];
  let sheetIndex = 0;
  for await (const worksheet of reader) {
    sheetIndex += 1;
    for await (const row of worksheet) {
      // Later sheets still have to be drained, but only the first one is imported.
      if (sheetIndex > 1) continue;
      sheetRows.push({
        rowNumber: row.number,
        cells: rowCells((column) => row.getCell(column).value),
      });
    }
  }
  return sheetRows;
}

/**
 * The two exceljs readers fail on different, non-overlapping file shapes:
 *  - workbook.xlsx.load() throws when a workbook's comment part is not at the path Excel
 *    uses, because reconcile() dereferences options.comments[rel.Target] unchecked;
 *  - the streaming reader throws when the zip lists sheet1.xml before workbook.xml,
 *    which is how exceljs itself writes files (so it cannot read data/template.xlsx).
 * Try the regular reader first, then fall back to the streaming one.
 */
export async function readXlsx(input: Buffer | ArrayBuffer): Promise<RawRow[]> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  try {
    return toRawRows(await readViaWorkbook(buffer));
  } catch (workbookError) {
    try {
      return toRawRows(await readViaStream(buffer));
    } catch (streamError) {
      throw new Error(
        `.xlsx файлыг уншиж чадсангүй. ` +
          `Үндсэн уншигч: ${(workbookError as Error).message} | ` +
          `Урсгал уншигч: ${(streamError as Error).message}`,
      );
    }
  }
}

export function readCsv(text: string): RawRow[] {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: false });
  const sheetRows = parsed.data.map((cells, index) => ({
    rowNumber: index + 1,
    cells: cells.map((cell) => cell ?? ""),
  }));
  return toRawRows(sheetRows);
}

/** Node-only convenience for the CLI; the admin panel passes an upload buffer instead. */
export async function readRowsFromFile(path: string): Promise<RawRow[]> {
  const lower = path.toLowerCase();
  if (lower.endsWith(".xlsx")) return readXlsx(await readFileFromDisk(path));
  if (lower.endsWith(".csv")) return readCsv(await readFileFromDisk(path, "utf8"));
  throw new Error(`Зөвхөн .xlsx эсвэл .csv файл дэмжигдэнэ: ${path}`);
}
