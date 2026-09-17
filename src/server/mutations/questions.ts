// Internal write helpers for the admin question editor: no auth checks. Only server
// actions call them, inside their own transaction. Never export from a "use server" file.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type OptionRow = {
  /** The existing Option this row edits, or null for a row the admin just added. */
  optionId: string | null;
  text: string;
  isCorrect: boolean;
  pinned: boolean;
};

export type ApplyOptionsResult = { deleted: number; created: number };

/**
 * Applies the editor's option rows to a question, KEYED BY OPTION ID.
 *
 * Option ids are stored in AttemptItem.optionOrder, so identity has to follow the
 * option, not its position: moving a row up only rewrites sortOrder, and an old
 * attempt keeps showing the text it was answered with. (The spreadsheet import matches
 * by text and then by position instead — a sheet row carries no ids.)
 *
 * sortOrder is unique per question, so every option is first parked on a negative
 * sortOrder: assigning the final positions directly would collide with the row that
 * still holds the target position.
 */
export async function applyQuestionOptions(
  tx: Tx,
  questionId: string,
  rows: readonly OptionRow[],
  { allowDelete }: { allowDelete: boolean },
): Promise<ApplyOptionsResult> {
  const keptIds = rows.map((row) => row.optionId).filter((id): id is string => id !== null);

  await tx.$executeRaw`
    UPDATE "Option" SET "sortOrder" = -1 - "sortOrder" WHERE "questionId" = ${questionId}`;

  let deleted = 0;
  if (allowDelete) {
    const removed = await tx.option.deleteMany({
      where: { questionId, id: { notIn: keptIds } },
    });
    deleted = removed.count;
  }

  let created = 0;
  for (const [index, row] of rows.entries()) {
    const data = {
      text: row.text,
      isCorrect: row.isCorrect,
      pinned: row.pinned,
      sortOrder: index,
    };
    if (row.optionId === null) {
      await tx.option.create({ data: { questionId, ...data } });
      created += 1;
    } else {
      await tx.option.update({ where: { id: row.optionId }, data });
    }
  }

  return { deleted, created };
}
