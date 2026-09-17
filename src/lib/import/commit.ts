// Writes validated rows to the database. The Prisma client is a parameter so this file
// stays independent of Next.js: the CLI passes a standalone client, the admin panel passes db.
//
// Options are matched by normalized TEXT first and then by position, and updated in
// place, so their ids stay stable — AttemptItem.optionOrder stores option ids, and
// neither re-importing a fixed file nor reordering the option columns may invalidate an
// existing attempt.
//
// Rows are written in chunks, each in its own transaction with an explicit timeout:
// Prisma's interactive transactions time out after 5 s by default, and a whole bank in
// one transaction would hold locks for minutes. commit() is idempotent per row (keyed on
// Question.code), so a run interrupted between chunks can simply be repeated.

import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { planOptions, type ExistingOption } from "./option-match";
import { uniqueSubjectSlug } from "./subject-slug";
import type { CommitResult, OptionInput, QuestionInput } from "./types";

type Tx = Prisma.TransactionClient;

export const DEFAULT_CHUNK_SIZE = 200;
export const DEFAULT_TRANSACTION_TIMEOUT_MS = 120_000;

export type CommitOptions = {
  /** Rows per transaction. */
  chunkSize?: number;
  transactionTimeoutMs?: number;
  /**
   * Called inside the same transaction for a question that already has attempts and
   * whose correct option moved to a different Option row. The admin import passes
   * resetProgressForQuestion here, so everyone's schedule for that question restarts.
   */
  onAnswerKeyChanged?: (tx: Tx, questionId: string) => Promise<unknown>;
};

function optionData(option: OptionInput) {
  return {
    text: option.text,
    isCorrect: option.isCorrect,
    pinned: option.pinned,
    sortOrder: option.sortOrder,
  };
}

async function resolveSubjectId(
  tx: Tx,
  name: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;

  const existing = await tx.subject.findUnique({ where: { name }, select: { id: true } });
  if (existing) {
    cache.set(name, existing.id);
    return existing.id;
  }

  const created = await tx.subject.create({
    data: {
      name,
      slug: await uniqueSubjectSlug(tx, name),
      sortOrder: await tx.subject.count(),
    },
  });
  cache.set(name, created.id);
  return created.id;
}

type ExistingQuestion = {
  id: string;
  code: string;
  subjectId: string;
  text: string;
  explanation: string | null;
  imageUrl: string | null;
  lockOptions: boolean;
  isActive: boolean;
  options: ExistingOption[];
};

/** Everything the chunk needs, in three queries instead of three per row. */
async function loadChunkContext(tx: Tx, rows: QuestionInput[]) {
  const codes = rows.map((row) => row.code);
  const texts = rows.map((row) => row.text);

  const existing = (await tx.question.findMany({
    where: { code: { in: codes } },
    select: {
      id: true,
      code: true,
      subjectId: true,
      text: true,
      explanation: true,
      imageUrl: true,
      lockOptions: true,
      isActive: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, isCorrect: true, pinned: true, sortOrder: true },
      },
    },
  })) as ExistingQuestion[];
  const byCode = new Map(existing.map((question) => [question.code, question]));

  // Questions that already hold one of these texts under a different code.
  const sameText = await tx.question.findMany({
    where: { text: { in: texts }, code: { notIn: codes } },
    select: { code: true, text: true },
  });
  const clashByText = new Map(sameText.map((question) => [question.text, question.code]));

  const answered =
    existing.length === 0
      ? []
      : await tx.attemptItem.groupBy({
          by: ["questionId"],
          where: { questionId: { in: existing.map((question) => question.id) } },
          _count: { _all: true },
        });
  const attemptsById = new Map(answered.map((row) => [row.questionId, row._count._all]));

  return { byCode, clashByText, attemptsById };
}

function chunked<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function commit(
  prisma: PrismaClient,
  rows: QuestionInput[],
  options: CommitOptions = {},
): Promise<CommitResult> {
  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const timeout = options.transactionTimeoutMs ?? DEFAULT_TRANSACTION_TIMEOUT_MS;

  const result: CommitResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    notes: [],
    warnings: [],
    answerKeyChanges: [],
  };
  // Subjects are shared across chunks; a name resolved once is not looked up again.
  const subjectIds = new Map<string, string>();

  for (const chunk of chunked(rows, chunkSize)) {
    await prisma.$transaction(
      async (tx) => {
        const { byCode, clashByText, attemptsById } = await loadChunkContext(tx, chunk);

        for (const row of chunk) {
          const subjectId = await resolveSubjectId(tx, row.subjectName, subjectIds);

          const clash = clashByText.get(row.text);
          if (clash) {
            result.warnings.push({
              rowNumber: row.rowNumber,
              code: row.code,
              message: `Ижил асуултын текст өгөгдлийн санд "${clash}" кодтойгоор аль хэдийн байна.`,
            });
          }

          const existing = byCode.get(row.code);

          if (!existing) {
            await tx.question.create({
              data: {
                code: row.code,
                subjectId,
                text: row.text,
                explanation: row.explanation ?? null,
                imageUrl: row.imageUrl ?? null,
                lockOptions: row.lockOptions,
                // A file without the "active" column creates active questions.
                isActive: row.isActive ?? true,
                options: { create: row.options.map(optionData) },
              },
            });
            result.created += 1;
            result.notes.push({
              rowNumber: row.rowNumber,
              code: row.code,
              status: "created",
              message: `${row.options.length} хувилбартай шинээр нэмэгдлээ.`,
            });
            continue;
          }

          const attempts = attemptsById.get(existing.id) ?? 0;
          const plan = planOptions(existing.options, row.options);

          // The "active" cell only speaks when it says something; an absent or empty
          // one leaves the question as it is.
          const questionChanged =
            existing.subjectId !== subjectId ||
            existing.text !== row.text ||
            existing.explanation !== (row.explanation ?? null) ||
            existing.imageUrl !== (row.imageUrl ?? null) ||
            existing.lockOptions !== row.lockOptions ||
            (row.isActive !== undefined && existing.isActive !== row.isActive);

          // Deleting an option an attempt already references would corrupt that attempt.
          const keepSurplus = plan.surplus.length > 0 && attempts > 0;
          const deleteSurplus = plan.surplus.length > 0 && attempts === 0;

          // Kept surplus options move to the end, after the rows the file describes.
          const finalOrder = new Map<string, number>();
          for (const assignment of plan.assignments) {
            if (assignment.existing) finalOrder.set(assignment.existing.id, assignment.target.sortOrder);
          }
          if (keepSurplus) {
            plan.surplus.forEach((option, index) => {
              finalOrder.set(option.id, row.options.length + index);
            });
          }

          const positionsMove = [...finalOrder.entries()].some(([id, sortOrder]) => {
            const before = existing.options.find((option) => option.id === id);
            return before !== undefined && before.sortOrder !== sortOrder;
          });
          const optionsChanged =
            deleteSurplus ||
            positionsMove ||
            plan.assignments.some((assignment) => assignment.changed);

          const oldCorrectId = existing.options.find((option) => option.isCorrect)?.id ?? null;
          const newCorrect = plan.assignments.find((assignment) => assignment.target.isCorrect);
          const newCorrectId = newCorrect?.existing?.id ?? null;
          const answerKeyChanged = newCorrectId !== oldCorrectId;

          if (optionsChanged) {
            if (deleteSurplus) {
              await tx.option.deleteMany({
                where: { id: { in: plan.surplus.map((option) => option.id) } },
              });
            }
            if (positionsMove) {
              // sortOrder is unique per question, so every option is parked on a
              // negative position first: assigning the final ones directly would
              // collide with whichever option still holds the target position.
              await tx.$executeRaw`
                UPDATE "Option" SET "sortOrder" = -1 - "sortOrder"
                WHERE "questionId" = ${existing.id}`;
            }
            for (const assignment of plan.assignments) {
              if (assignment.existing === null) {
                await tx.option.create({
                  data: { questionId: existing.id, ...optionData(assignment.target) },
                });
              } else if (assignment.changed || positionsMove) {
                await tx.option.update({
                  where: { id: assignment.existing.id },
                  data: optionData(assignment.target),
                });
              }
            }
            if (keepSurplus && positionsMove) {
              for (const option of plan.surplus) {
                await tx.option.update({
                  where: { id: option.id },
                  data: { sortOrder: finalOrder.get(option.id)! },
                });
              }
            }
          }

          if (questionChanged) {
            await tx.question.update({
              where: { id: existing.id },
              data: {
                subjectId,
                text: row.text,
                explanation: row.explanation ?? null,
                imageUrl: row.imageUrl ?? null,
                lockOptions: row.lockOptions,
                ...(row.isActive === undefined ? {} : { isActive: row.isActive }),
              },
            });
          }

          if (answerKeyChanged && attempts > 0) {
            result.answerKeyChanges.push({ rowNumber: row.rowNumber, code: row.code });
            await options.onAnswerKeyChanged?.(tx, existing.id);
          }

          if (keepSurplus) {
            result.skipped += 1;
            result.notes.push({
              rowNumber: row.rowNumber,
              code: row.code,
              status: "skipped",
              message:
                `Хувилбарын тоо ${existing.options.length} -> ${row.options.length} болж багассан ` +
                `боловч оролдлого (attempt) бүртгэгдсэн тул хуучин ${plan.surplus.length} хувилбарыг ` +
                "устгасангүй. Гараар шалгана уу.",
            });
          } else if (questionChanged || optionsChanged) {
            result.updated += 1;
            result.notes.push({
              rowNumber: row.rowNumber,
              code: row.code,
              status: "updated",
              message: answerKeyChanged
                ? "Шинэчлэгдлээ; зөв хариулт өөрчлөгдсөн (хувилбаруудын id хөдлөөгүй)."
                : "Шинэчлэгдлээ (хувилбаруудын id хөдлөөгүй).",
            });
          } else {
            result.unchanged += 1;
            result.notes.push({
              rowNumber: row.rowNumber,
              code: row.code,
              status: "unchanged",
              message: "Өөрчлөлтгүй.",
            });
          }
        }
      },
      { maxWait: 10_000, timeout },
    );
  }

  return result;
}
