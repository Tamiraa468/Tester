import "dotenv/config";
// Relative imports (not "@/...") so tsx resolves them without path aliases.
import { commit } from "../src/lib/import/commit";
import { parseRows } from "../src/lib/import/parse";
import { readRowsFromFile } from "../src/lib/import/read";
import type { Issue, ParsedRow } from "../src/lib/import/types";
import { validate } from "../src/lib/import/validate";
import { createPrismaClient } from "../src/lib/prisma";

const LETTERS = "abcdef";

function formatIssue(issue: Issue): string {
  const code = issue.code ? ` [${issue.code}]` : "";
  return `  мөр ${issue.rowNumber}${code}: ${issue.message}`;
}

/** code -> correct answer letter, using the option's ORIGINAL column (as printed in the book). */
function formatAnswers(rows: ParsedRow[]): string[] {
  const lines: string[] = [];
  for (const row of rows) {
    const index = row.options.findIndex((option) => option.isCorrect);
    if (index === -1) continue;
    const column = row.optionColumns[index];
    lines.push(
      `  ${row.code}: ${LETTERS[column - 1]} (option_${column}, ${row.options.length} хувилбар)`,
    );
  }
  return lines;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((arg) => !arg.startsWith("--"));

  if (!file) {
    console.error("Хэрэглээ: pnpm import:questions <файл.xlsx|файл.csv> [--dry-run]");
    process.exitCode = 1;
    return;
  }

  const raw = await readRowsFromFile(file);
  const { rows, warnings: parseWarnings } = parseRows(raw);
  const { valid, errors, warnings } = validate(rows);
  const allWarnings = [...parseWarnings, ...warnings].sort((a, b) => a.rowNumber - b.rowNumber);

  console.log(`Файл: ${file}`);
  console.log(`Уншсан мөр: ${rows.length}`);
  console.log(`Алдаа: ${errors.length} | Санамж: ${allWarnings.length}`);

  if (errors.length > 0) {
    console.log(`\n✖ Алдаа (${errors.length}) — эдгээр мөр импортлогдохгүй:`);
    for (const issue of errors) console.log(formatIssue(issue));
  }
  if (allWarnings.length > 0) {
    console.log(`\n⚠ Санамж (${allWarnings.length}) — импортод саад болохгүй:`);
    for (const issue of allWarnings) console.log(formatIssue(issue));
  }

  const answers = formatAnswers(rows);
  if (answers.length > 0) {
    console.log(`\nЗөв хариулт (${answers.length}):`);
    for (const line of answers) console.log(line);
  }

  if (errors.length > 0) {
    console.log("\nАлдааг зассаны дараа дахин оролдоно уу. Өгөгдлийн санд юу ч бичигдсэнгүй.");
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(
      `\n✔ Туршилтын режим (--dry-run): ${valid.length} мөр импортод бэлэн. ` +
        "Өгөгдлийн санд хандсангүй.",
    );
    return;
  }

  const prisma = createPrismaClient(process.env.DIRECT_URL);
  try {
    const result = await commit(prisma, valid);

    if (result.warnings.length > 0) {
      console.log(`\n⚠ Өгөгдлийн сангийн санамж (${result.warnings.length}):`);
      for (const issue of result.warnings) console.log(formatIssue(issue));
    }

    console.log("\nМөр тус бүр:");
    for (const note of result.notes) {
      console.log(`  мөр ${note.rowNumber} [${note.code}] ${note.status}: ${note.message ?? ""}`);
    }

    if (result.answerKeyChanges.length > 0) {
      // The admin panel asks for confirmation and resets the affected users' progress;
      // the CLI cannot reach that helper (it is server-only), so it says so plainly.
      const codes = result.answerKeyChanges.map((change) => change.code).join(", ");
      console.log(
        `\n⚠ Зөв хариулт өөрчлөгдсөн асуултууд (${result.answerKeyChanges.length}): ${codes}\n` +
          "  Эдгээрийг хариулж байсан хэрэглэгчдийн давтлага тэглэгдээгүй. " +
          "Админ хэсгийн Импортоор оруулбал автоматаар тэглэнэ.",
      );
    }

    console.log(
      `\n✔ Дүн: шинэ ${result.created} | шинэчилсэн ${result.updated} | ` +
        `өөрчлөлтгүй ${result.unchanged} | хүлээлгэсэн ${result.skipped}`,
    );
    if (result.skipped > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
