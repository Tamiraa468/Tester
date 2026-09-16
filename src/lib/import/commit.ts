// Writes validated rows to the database. The Prisma client is a parameter so this file
// stays independent of Next.js: the CLI passes a standalone client, the admin panel passes db.
//
// Options are updated IN PLACE by sortOrder so their ids stay stable — AttemptItem.optionOrder
// stores option ids, and re-importing a fixed file must not invalidate existing attempts.

import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { slugify } from "../slug";
import type { CommitResult, OptionInput, QuestionInput } from "./types";

type Tx = Prisma.TransactionClient;

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

  // Subject.slug is unique and transliteration can collide (ө and о both become "o").
  const base = slugify(name) || "subject";
  let slug = base;
  let suffix = 2;
  while (await tx.subject.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const created = await tx.subject.create({
    data: { name, slug, sortOrder: await tx.subject.count() },
  });
  cache.set(name, created.id);
  return created.id;
}

export async function commit(prisma: PrismaClient, rows: QuestionInput[]): Promise<CommitResult> {
  return prisma.$transaction(
    async (tx) => {
      const result: CommitResult = {
        created: 0,
        updated: 0,
        unchanged: 0,
        skipped: 0,
        notes: [],
        warnings: [],
      };
      const subjectIds = new Map<string, string>();

      for (const row of rows) {
        const subjectId = await resolveSubjectId(tx, row.subjectName, subjectIds);

        const sameText = await tx.question.findFirst({
          where: { text: row.text, code: { not: row.code } },
          select: { code: true },
        });
        if (sameText) {
          result.warnings.push({
            rowNumber: row.rowNumber,
            code: row.code,
            message:
              `Ижил асуултын текст өгөгдлийн санд "${sameText.code}" кодтойгоор аль хэдийн байна.`,
          });
        }

        const data = {
          subjectId,
          text: row.text,
          explanation: row.explanation ?? null,
          imageUrl: row.imageUrl ?? null,
          lockOptions: row.lockOptions,
        };

        const existing = await tx.question.findUnique({
          where: { code: row.code },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        });

        if (!existing) {
          await tx.question.create({
            data: {
              code: row.code,
              ...data,
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

        const questionChanged =
          existing.subjectId !== subjectId ||
          existing.text !== row.text ||
          existing.explanation !== (row.explanation ?? null) ||
          existing.imageUrl !== (row.imageUrl ?? null) ||
          existing.lockOptions !== row.lockOptions;

        let optionsChanged = false;
        const shared = Math.min(existing.options.length, row.options.length);

        // Ascending order keeps sortOrder unique at every step when positions compact.
        for (let index = 0; index < shared; index += 1) {
          const before = existing.options[index];
          const after = row.options[index];
          if (
            before.text !== after.text ||
            before.isCorrect !== after.isCorrect ||
            before.pinned !== after.pinned ||
            before.sortOrder !== after.sortOrder
          ) {
            await tx.option.update({ where: { id: before.id }, data: optionData(after) });
            optionsChanged = true;
          }
        }

        for (let index = shared; index < row.options.length; index += 1) {
          await tx.option.create({
            data: { questionId: existing.id, ...optionData(row.options[index]) },
          });
          optionsChanged = true;
        }

        let keptSurplus = 0;
        if (row.options.length < existing.options.length) {
          const attempts = await tx.attemptItem.count({ where: { questionId: existing.id } });
          if (attempts > 0) {
            // Deleting an option that an attempt already references would corrupt that attempt.
            keptSurplus = existing.options.length - row.options.length;
          } else {
            await tx.option.deleteMany({
              where: { questionId: existing.id, sortOrder: { gte: row.options.length } },
            });
            optionsChanged = true;
          }
        }

        if (questionChanged) {
          await tx.question.update({ where: { id: existing.id }, data });
        }

        if (keptSurplus > 0) {
          result.skipped += 1;
          result.notes.push({
            rowNumber: row.rowNumber,
            code: row.code,
            status: "skipped",
            message:
              `Хувилбарын тоо ${existing.options.length} -> ${row.options.length} болж багассан ` +
              `боловч оролдлого (attempt) бүртгэгдсэн тул хуучин ${keptSurplus} хувилбарыг ` +
              "устгасангүй. Гараар шалгана уу.",
          });
        } else if (questionChanged || optionsChanged) {
          result.updated += 1;
          result.notes.push({
            rowNumber: row.rowNumber,
            code: row.code,
            status: "updated",
            message: "Шинэчлэгдлээ (хувилбаруудын id хөдлөөгүй).",
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

      return result;
    },
    { maxWait: 10_000, timeout: 120_000 },
  );
}
