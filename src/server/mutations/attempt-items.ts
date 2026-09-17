// Internal write helper: no auth checks. Only server actions call it.
import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { latestOptionOrderByQuestion, previousCorrectIndex } from "@/lib/quiz/attempt";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { buildOptionOrder } from "@/lib/quiz/shuffle";

type Reader = Pick<Prisma.TransactionClient, "question" | "attemptItem">;

/**
 * Option orders for a new attempt, in the given question order. Questions that are no
 * longer active, or have no options, are dropped. The correct option avoids the
 * position it had in this user's most recent attempt of the question (one query).
 */
export async function buildAttemptItems(
  client: Reader,
  userId: string,
  questionIds: readonly string[],
): Promise<{ questionId: string; optionOrder: string[] }[]> {
  if (questionIds.length === 0) return [];
  const ids = [...questionIds];

  const [questions, previousItems] = await Promise.all([
    client.question.findMany({
      where: { id: { in: ids }, isActive: true },
      select: {
        id: true,
        lockOptions: true,
        options: { select: { id: true, isCorrect: true, pinned: true, sortOrder: true } },
      },
    }),
    client.attemptItem.findMany({
      where: { questionId: { in: ids }, attempt: { userId } },
      distinct: ["questionId"],
      orderBy: [{ attempt: { startedAt: "desc" } }, { attemptId: "desc" }],
      select: { questionId: true, optionOrder: true },
    }),
  ]);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const latestOrder = latestOptionOrderByQuestion(previousItems);

  return ids.flatMap((questionId) => {
    const question = questionById.get(questionId);
    if (!question || question.options.length === 0) return [];
    const correct = question.options.find((option) => option.isCorrect);
    return [
      {
        questionId,
        optionOrder: buildOptionOrder(question.options, {
          lockOptions: question.lockOptions,
          previousCorrectIndex: previousCorrectIndex(latestOrder.get(questionId), correct?.id),
          rand: cryptoRandomInt,
        }),
      },
    ];
  });
}
