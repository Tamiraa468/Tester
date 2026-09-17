"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";
import { commit } from "@/lib/import/commit";
import { planOptions } from "@/lib/import/option-match";
import { parseRows } from "@/lib/import/parse";
import { readCsv, readXlsx } from "@/lib/import/read";
import type { Issue, QuestionInput } from "@/lib/import/types";
import { validate } from "@/lib/import/validate";
import { resetProgressForQuestion } from "@/server/mutations/progress";
import {
  IMPORT_MESSAGES,
  MAX_DATA_ROWS,
  PREVIEW_MAX_ISSUES,
  PREVIEW_SAMPLE_SIZE,
  readUploadForm,
  uploadSchema,
} from "./import.schemas";

export type AdminActionError = { error: string };

export type PreviewIssue = { rowNumber: number; code?: string; kind: "error" | "warning"; message: string };

export type PreviewRow = {
  rowNumber: number;
  code: string;
  subjectName: string;
  text: string;
  optionCount: number;
  action: "create" | "update";
};

/** A question with attempts whose correct option would move to another option. */
export type AnswerKeyChange = { code: string; rowNumber: number; affectedUsers: number };

export type ImportPreview = {
  fileName: string;
  totals: {
    rows: number;
    valid: number;
    errors: number;
    warnings: number;
    toCreate: number;
    toUpdate: number;
  };
  issues: PreviewIssue[];
  /** How many issues were left out of `issues`. */
  issuesTruncated: number;
  /** At most the first PREVIEW_SAMPLE_SIZE valid rows, so the response stays small. */
  sample: PreviewRow[];
  answerKeyChanges: AnswerKeyChange[];
  canImport: boolean;
};

export type ImportSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  notes: { rowNumber: number; code: string; message: string }[];
  warnings: PreviewIssue[];
  answerKeyChanges: string[];
  elapsedMs: number;
};

export type NeedsConfirmation = { needsConfirmation: { changes: AnswerKeyChange[] } };

/** Codes are looked up in batches; a 5,000-row file must not become 5,000 queries. */
const LOOKUP_CHUNK = 500;

type Pipeline = {
  fileName: string;
  rowCount: number;
  valid: QuestionInput[];
  errors: Issue[];
  warnings: Issue[];
};

async function runPipeline(file: File): Promise<Pipeline | AdminActionError> {
  let raw;
  try {
    raw = file.name.toLowerCase().endsWith(".csv")
      ? readCsv(await file.text())
      : await readXlsx(await file.arrayBuffer());
  } catch (error) {
    return { error: IMPORT_MESSAGES.unreadable((error as Error).message) };
  }

  if (raw.length > MAX_DATA_ROWS) return { error: IMPORT_MESSAGES.tooManyRows(raw.length) };

  const parsed = parseRows(raw);
  const result = validate(parsed.rows);
  return {
    fileName: file.name,
    rowCount: parsed.rows.length,
    valid: result.valid,
    errors: result.errors,
    warnings: [...parsed.warnings, ...result.warnings],
  };
}

type BankEntry = {
  id: string;
  exists: true;
  answerKeyMoves: boolean;
  affectedUsers: number;
};

/**
 * What the bank already holds for these rows: whether each code exists, and whether the
 * file would move the correct answer onto a different Option of a question users have
 * already answered. The same matching the commit uses decides that, so the preview and
 * the write agree.
 */
async function inspectBank(rows: QuestionInput[]): Promise<Map<string, BankEntry>> {
  const found = new Map<string, BankEntry>();

  for (let index = 0; index < rows.length; index += LOOKUP_CHUNK) {
    const chunk = rows.slice(index, index + LOOKUP_CHUNK);
    const existing = await db.question.findMany({
      where: { code: { in: chunk.map((row) => row.code) } },
      select: {
        id: true,
        code: true,
        options: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, text: true, isCorrect: true, pinned: true, sortOrder: true },
        },
        _count: { select: { attemptItems: true, progress: true } },
      },
    });
    const byCode = new Map(existing.map((question) => [question.code, question]));

    for (const row of chunk) {
      const question = byCode.get(row.code);
      if (!question) continue;
      const plan = planOptions(question.options, row.options);
      const oldCorrectId = question.options.find((option) => option.isCorrect)?.id ?? null;
      const newCorrectId =
        plan.assignments.find((assignment) => assignment.target.isCorrect)?.existing?.id ?? null;
      found.set(row.code, {
        id: question.id,
        exists: true,
        answerKeyMoves: newCorrectId !== oldCorrectId && question._count.attemptItems > 0,
        affectedUsers: question._count.progress,
      });
    }
  }

  return found;
}

function answerKeyChanges(rows: QuestionInput[], bank: Map<string, BankEntry>): AnswerKeyChange[] {
  return rows
    .filter((row) => bank.get(row.code)?.answerKeyMoves)
    .map((row) => ({
      code: row.code,
      rowNumber: row.rowNumber,
      affectedUsers: bank.get(row.code)!.affectedUsers,
    }));
}

/**
 * Reads, parses and validates the file and reports what an import would do. Writes
 * nothing. The response carries every row that has a problem plus the first few valid
 * rows, so a large file does not turn into a large response.
 */
export async function previewImport(
  formData: FormData,
): Promise<ImportPreview | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = uploadSchema.safeParse(readUploadForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { file } = parsed.data;

  const pipeline = await runPipeline(file);
  if ("error" in pipeline) return pipeline;

  const bank = await inspectBank(pipeline.valid);
  const issues: PreviewIssue[] = [
    ...pipeline.errors.map((issue) => ({ ...issue, kind: "error" as const })),
    ...pipeline.warnings.map((issue) => ({ ...issue, kind: "warning" as const })),
  ].sort((a, b) => a.rowNumber - b.rowNumber || (a.kind === b.kind ? 0 : a.kind === "error" ? -1 : 1));

  const changes = answerKeyChanges(pipeline.valid, bank);
  for (const change of changes) {
    issues.push({
      rowNumber: change.rowNumber,
      code: change.code,
      kind: "warning",
      message:
        `Зөв хариулт өөрчлөгдөж байна. ${change.affectedUsers} хэрэглэгчийн ` +
        "энэ асуулт дахь давтлага тэглэгдэнэ.",
    });
  }

  const toCreate = pipeline.valid.filter((row) => !bank.has(row.code)).length;

  return {
    fileName: pipeline.fileName,
    totals: {
      rows: pipeline.rowCount,
      valid: pipeline.valid.length,
      errors: pipeline.errors.length,
      warnings: pipeline.warnings.length + changes.length,
      toCreate,
      toUpdate: pipeline.valid.length - toCreate,
    },
    issues: issues.slice(0, PREVIEW_MAX_ISSUES),
    issuesTruncated: Math.max(0, issues.length - PREVIEW_MAX_ISSUES),
    sample: pipeline.valid.slice(0, PREVIEW_SAMPLE_SIZE).map((row) => ({
      rowNumber: row.rowNumber,
      code: row.code,
      subjectName: row.subjectName,
      text: row.text,
      optionCount: row.options.length,
      action: bank.has(row.code) ? ("update" as const) : ("create" as const),
    })),
    answerKeyChanges: changes,
    canImport: pipeline.errors.length === 0 && pipeline.valid.length > 0,
  };
}

/**
 * Imports the file. It is read and validated AGAIN here rather than trusting anything
 * the preview sent back, so only the bytes the browser uploaded are ever written; and
 * an answer key that moves on a question users have answered needs the admin's explicit
 * confirmation, after which commit resets those users' progress in the same transaction.
 */
export async function runImport(
  formData: FormData,
): Promise<ImportSummary | NeedsConfirmation | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = uploadSchema.safeParse(readUploadForm(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { file, confirmAnswerChanges } = parsed.data;

  const pipeline = await runPipeline(file);
  if ("error" in pipeline) return pipeline;
  if (pipeline.errors.length > 0) return { error: IMPORT_MESSAGES.hasErrors };
  if (pipeline.valid.length === 0) return { error: IMPORT_MESSAGES.hasErrors };

  const bank = await inspectBank(pipeline.valid);
  const changes = answerKeyChanges(pipeline.valid, bank);
  if (changes.length > 0 && !confirmAnswerChanges) {
    return { needsConfirmation: { changes } };
  }

  const startedAt = Date.now();
  const result = await commit(db, pipeline.valid, {
    onAnswerKeyChanged: (tx, questionId) => resetProgressForQuestion(tx, questionId, now()),
  });
  const elapsedMs = Date.now() - startedAt;

  revalidatePath("/admin");
  revalidatePath("/admin/questions");
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/exam-presets");
  revalidatePath("/practice");
  revalidatePath("/exam");

  return {
    created: result.created,
    updated: result.updated,
    unchanged: result.unchanged,
    skipped: result.skipped,
    // Only the rows that need a second look travel back.
    notes: result.notes
      .filter((note) => note.status === "skipped")
      .map((note) => ({ rowNumber: note.rowNumber, code: note.code, message: note.message ?? "" })),
    warnings: result.warnings
      .slice(0, PREVIEW_MAX_ISSUES)
      .map((issue) => ({ ...issue, kind: "warning" as const })),
    answerKeyChanges: result.answerKeyChanges.map((change) => change.code),
    elapsedMs,
  };
}
