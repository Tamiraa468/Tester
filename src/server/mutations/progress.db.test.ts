import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { MAX_BOX } from "@/lib/quiz/leitner";
import { createPracticeAttempt, submitPracticeAnswer } from "@/server/actions/practice";
import { correctOptionId, TestScope } from "@/test/db/fixtures";
import { redirectedId, signInAs } from "@/test/db/session";
import { applyProgress } from "./progress";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const NOW = new Date("2026-09-17T03:00:00.000Z");

async function progressOf(userId: string, questionIds: string[]) {
  const rows = await db.questionProgress.findMany({ where: { userId, questionId: { in: questionIds } } });
  return new Map(rows.map((row) => [row.questionId, row]));
}

describe("applyProgress", () => {
  it("creates, promotes and demotes rows, and stamps times in UTC", async () => {
    const { id: userId } = await scope.user("progress", { create: true });
    const { questionIds: [a, b] } = await scope.subject(2);

    await db.$transaction((tx) =>
      applyProgress(tx, userId!, [
        { questionId: a, isCorrect: true },
        { questionId: b, isCorrect: false },
      ], NOW),
    );
    let rows = await progressOf(userId!, [a, b]);
    expect(rows.get(a)).toEqual(expect.objectContaining({ box: 1, correctCount: 1, wrongCount: 0 }));
    expect(rows.get(a)!.lastAnsweredAt).toEqual(NOW);
    expect(rows.get(a)!.nextReviewAt).toEqual(new Date(NOW.getTime() + 24 * 60 * 60_000));
    expect(rows.get(b)).toEqual(expect.objectContaining({ box: 0, correctCount: 0, wrongCount: 1 }));
    expect(rows.get(b)!.nextReviewAt).toEqual(new Date(NOW.getTime() + 10 * 60_000));

    // Same question twice in one batch counts twice.
    await db.$transaction((tx) =>
      applyProgress(tx, userId!, [
        { questionId: a, isCorrect: true },
        { questionId: a, isCorrect: true },
        { questionId: b, isCorrect: true },
      ], NOW),
    );
    rows = await progressOf(userId!, [a, b]);
    expect(rows.get(a)).toEqual(expect.objectContaining({ box: 3, correctCount: 3 }));
    expect(rows.get(b)).toEqual(expect.objectContaining({ box: 1, correctCount: 1, wrongCount: 1 }));
  });

  it("does nothing for an empty batch", async () => {
    const { id: userId } = await scope.user("progress-empty", { create: true });
    await db.$transaction((tx) => applyProgress(tx, userId!, [], NOW));
    expect(await db.questionProgress.count({ where: { userId } })).toBe(0);
  });

  it("counts every concurrent batch, in any order, without deadlocks or failed first saves", async () => {
    const { id: userId } = await scope.user("progress-race", { create: true });
    const { questionIds } = await scope.subject(8);
    const reversed = [...questionIds].reverse();

    // 24 transactions at once over the same, still missing, rows: half in one order,
    // half in the reverse order, which is the classic deadlock shape.
    const batches = Array.from({ length: 24 }, (_, index) =>
      (index % 2 === 0 ? questionIds : reversed).map((questionId) => ({ questionId, isCorrect: true })),
    );
    const results = await Promise.allSettled(
      batches.map((batch) => db.$transaction((tx) => applyProgress(tx, userId!, batch, NOW))),
    );
    expect(results.filter((result) => result.status === "rejected")).toEqual([]);

    const rows = await progressOf(userId!, questionIds);
    for (const questionId of questionIds) {
      expect(rows.get(questionId)!.correctCount).toBe(24);
      expect(rows.get(questionId)!.box).toBe(MAX_BOX);
    }
  });
});

describe("concurrent practice answers to the same question from two attempts", () => {
  it("are both counted, and the first save never fails", async () => {
    const { clerkId } = await scope.user("two-attempts");
    const { questionIds } = await scope.subject(10);
    signInAs(clerkId);

    // A bank of exactly 10 questions: both attempts contain all of them.
    const first = await redirectedId(createPracticeAttempt({ source: "RANDOM", count: 10 }), "/practice");
    const second = await redirectedId(createPracticeAttempt({ source: "RANDOM", count: 10 }), "/practice");
    const items = await db.attemptItem.findMany({
      where: { attemptId: { in: [first, second] } },
      select: { id: true, questionId: true, attemptId: true },
    });
    expect(items).toHaveLength(20);

    // No progress rows exist yet, so every pair races on creating the row.
    const answers = await Promise.all(
      items.map(async (item) => {
        const correct = await correctOptionId(item.questionId);
        // First attempt answers right, second answers wrong.
        const optionId =
          item.attemptId === first
            ? correct
            : (await db.option.findFirstOrThrow({ where: { questionId: item.questionId, isCorrect: false } })).id;
        return { item, optionId };
      }),
    );
    const results = await Promise.all(
      answers.map(({ item, optionId }) => submitPracticeAnswer({ attemptItemId: item.id, optionId })),
    );
    expect(results.filter((result) => "error" in result)).toEqual([]);

    const rows = await progressOf(await scope.userId(clerkId), questionIds);
    expect(rows.size).toBe(10);
    for (const questionId of questionIds) {
      const row = rows.get(questionId)!;
      expect(row.correctCount, questionId).toBe(1);
      expect(row.wrongCount, questionId).toBe(1);
    }
  });
});
