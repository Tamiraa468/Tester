// Streams a whole question bank into an .xlsx in the template's shape.
//
// The workbook is written row by row through ExcelJS's streaming writer, so neither the
// rows nor the finished file are ever held in memory in full: a 5,000-question bank
// stays a few megabytes on the wire and a few kilobytes in the process.

import type { Writable } from "node:stream";
import ExcelJS from "exceljs";
import { templateRowValues, toTemplateRow, type ExportQuestion } from "./export";
import { HEADERS } from "./types";

export async function streamQuestionsWorkbook(
  stream: Writable,
  questions: AsyncIterable<ExportQuestion>,
): Promise<number> {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream,
    useStyles: false,
    // Inline strings: nothing has to be kept around to be de-duplicated at the end.
    useSharedStrings: false,
  });
  const sheet = workbook.addWorksheet("questions");
  sheet.addRow([...HEADERS]).commit();

  let written = 0;
  for await (const question of questions) {
    // Plain strings only. ExcelJS writes a formula only for a { formula } value, so a
    // text beginning with "=" is stored as text.
    sheet.addRow(templateRowValues(toTemplateRow(question))).commit();
    written += 1;
  }

  sheet.commit();
  await workbook.commit();
  return written;
}
