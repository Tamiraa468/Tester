import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getAttemptForPlayer, listUnfinishedPracticeAttempts } from "@/server/queries/attempts";
import { correctOptionId, TestScope } from "@/test/db/fixtures";
import { expectRedirect, redirectedId, signInAs } from "@/test/db/session";
import {
  createPracticeAttempt,
  finishPracticeAttempt,
  reportQuestion,
  submitPracticeAnswer,
  setBookmark,
} from "./practice";
import { PRACTICE_MESSAGES } from "./practice.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const FORBIDDEN = /isCorrect|correctOptionId|explanation|Тайлбар/;

async function setup() {
  const bank = await scope.subject([
    { pinnedLast: true },
    { lockOptions: true },
    ...Array.from({ length: 10 }, () => ({})),
    { isActive: false },
  ]);
  const alice = await scope.user("alice", { create: true });
  const bob = await scope.user("bob", { create: true });
  signInAs(alice.clerkId);
  return { bank, alice, bob };
}

const start = (input: Parameters<typeof createPracticeAttempt>[0]) =>
  redirectedId(createPracticeAttempt(input), "/practice");

describe("practice", () => {
  it("refuses signed-out and invalid requests, and never creates an empty attempt", async () => {
    const { alice } = await setup();
    signInAs(null);
    await expect(createPracticeAttempt({ source: "RANDOM", count: 10 })).rejects.toThrow("UNAUTHENTICATED");

    signInAs(alice.clerkId);
    expect(await createPracticeAttempt({ source: "RANDOM", count: 15 as 10 })).toEqual({
      error: PRACTICE_MESSAGES.invalid,
    });
    expect(await createPracticeAttempt({ source: "BOOKMARKED", count: 10 })).toEqual({
      error: PRACTICE_MESSAGES.noQuestions,
    });
    expect(await db.attempt.count({ where: { userId: await scope.userId(alice.clerkId) } })).toBe(0);
  });

  it("runs a 10-question practice: same order on reload, feedback restored, progress updated", async () => {
    const { bank, alice } = await setup();
    const userId = await scope.userId(alice.clerkId);
    const id = await start({ source: "RANDOM", count: 10 });

    const first = await getAttemptForPlayer(id, userId);
    expect(first!.items).toHaveLength(10);
    const again = await getAttemptForPlayer(id, userId);
    expect(again!.items.map((i) => i.options.map((o) => o.id))).toEqual(
      first!.items.map((i) => i.options.map((o) => o.id)),
    );
    for (const item of first!.items) {
      expect(bank.questionIds).toContain(item.questionId);
      expect(JSON.stringify(item)).not.toMatch(FORBIDDEN);
    }

    const [right, wrong] = first!.items;
    const rightOption = await correctOptionId(right.questionId);
    const wrongCorrect = await correctOptionId(wrong.questionId);
    const wrongOption = wrong.options.find((o) => o.id !== wrongCorrect)!.id;

    expect(await submitPracticeAnswer({ attemptItemId: right.id, optionId: rightOption })).toEqual(
      expect.objectContaining({ isCorrect: true, correctOptionId: rightOption }),
    );
    expect(await submitPracticeAnswer({ attemptItemId: wrong.id, optionId: wrongOption })).toEqual(
      expect.objectContaining({ isCorrect: false, correctOptionId: wrongCorrect, selectedOptionId: wrongOption }),
    );

    const progress = await db.questionProgress.findMany({ where: { userId } });
    expect(progress.find((row) => row.questionId === right.questionId)).toEqual(
      expect.objectContaining({ box: 1, correctCount: 1, wrongCount: 0 }),
    );
    expect(progress.find((row) => row.questionId === wrong.questionId)).toEqual(
      expect.objectContaining({ box: 0, correctCount: 0, wrongCount: 1 }),
    );

    const reloaded = await getAttemptForPlayer(id, userId);
    expect(reloaded!.items[1].result).toEqual(
      expect.objectContaining({ isCorrect: false, correctOptionId: wrongCorrect }),
    );
    for (const item of reloaded!.items.slice(2)) expect(JSON.stringify(item)).not.toMatch(FORBIDDEN);

    expect(await listUnfinishedPracticeAttempts(userId)).toEqual([
      expect.objectContaining({ id, answeredCount: 2, totalCount: 10 }),
    ]);
  });

  it("counts a double click once and rejects options from other items", async () => {
    const { alice } = await setup();
    const userId = await scope.userId(alice.clerkId);
    const id = await start({ source: "RANDOM", count: 10 });
    const [item, other] = await db.attemptItem.findMany({ where: { attemptId: id }, orderBy: { position: "asc" } });

    expect(await submitPracticeAnswer({ attemptItemId: item.id, optionId: other.optionOrder[0] })).toEqual({
      error: PRACTICE_MESSAGES.invalid,
    });
    const [a, b] = await Promise.all([
      submitPracticeAnswer({ attemptItemId: item.id, optionId: item.optionOrder[0] }),
      submitPracticeAnswer({ attemptItemId: item.id, optionId: item.optionOrder[1] }),
    ]);
    expect(a).toEqual(b);
    const row = await db.questionProgress.findUniqueOrThrow({
      where: { userId_questionId: { userId, questionId: item.questionId } },
    });
    expect(row.correctCount + row.wrongCount).toBe(1);
  });

  it("keeps pinned options last, locked options in place, and varies the order between practices", async () => {
    const { bank } = await setup();
    const orders = new Map<string, string[][]>();
    for (let run = 0; run < 6; run += 1) {
      const id = await start({ source: "RANDOM", count: 50 });
      for (const item of await db.attemptItem.findMany({ where: { attemptId: id } })) {
        orders.set(item.questionId, [...(orders.get(item.questionId) ?? []), item.optionOrder]);
      }
    }
    const questions = await db.question.findMany({
      where: { id: { in: bank.questionIds }, isActive: true },
      include: { options: { orderBy: { sortOrder: "asc" } } },
    });
    expect(orders.size).toBe(12);
    let repeats = 0;
    for (const question of questions) {
      const list = orders.get(question.id)!;
      const correct = question.options.find((o) => o.isCorrect)!;
      for (const [index, order] of list.entries()) {
        if (question.lockOptions) expect(order).toEqual(question.options.map((o) => o.id));
        const pinned = question.options.find((o) => o.pinned);
        if (pinned) expect(order.at(-1)).toBe(pinned.id);
        if (index > 0 && !question.lockOptions && !correct.pinned) {
          if (order.indexOf(correct.id) === list[index - 1].indexOf(correct.id)) repeats += 1;
        }
      }
    }
    // With 5 retries a repeat has odds of about (1/4)^6 per comparison.
    expect(repeats).toBe(0);
  });

  it("finishes, refuses later answers and retries the wrong ones", async () => {
    await setup();
    const id = await start({ source: "RANDOM", count: 10 });
    const items = await db.attemptItem.findMany({ where: { attemptId: id }, orderBy: { position: "asc" } });
    for (const item of items.slice(0, 3)) {
      const correct = await correctOptionId(item.questionId);
      await submitPracticeAnswer({
        attemptItemId: item.id,
        optionId: item.optionOrder.find((optionId) => optionId !== correct)!,
      });
    }

    expect(await expectRedirect(finishPracticeAttempt(id))).toBe(`/practice/${id}/summary`);
    expect(await expectRedirect(finishPracticeAttempt(id))).toBe(`/practice/${id}/summary`);
    expect(await db.attempt.findUniqueOrThrow({ where: { id } })).toEqual(
      expect.objectContaining({ status: "SUBMITTED", correctCount: 0 }),
    );
    expect(await submitPracticeAnswer({ attemptItemId: items[5].id, optionId: items[5].optionOrder[0] })).toEqual({
      error: PRACTICE_MESSAGES.attemptClosed,
    });

    const retryId = await start({ source: "CUSTOM", fromAttemptId: id });
    const retry = await db.attemptItem.findMany({ where: { attemptId: retryId } });
    expect(retry.map((item) => item.questionId).sort()).toEqual(
      items.slice(0, 3).map((item) => item.questionId).sort(),
    );
  });

  it("sets bookmarks idempotently and limits reports", async () => {
    const { bank, alice } = await setup();
    const userId = await scope.userId(alice.clerkId);
    const [questionId] = bank.questionIds;
    const bookmarks = () => db.bookmark.count({ where: { userId, questionId } });

    expect(await setBookmark({ questionId, bookmarked: true })).toEqual({ bookmarked: true });
    // Adding twice is not an error and does not duplicate the row.
    expect(await setBookmark({ questionId, bookmarked: true })).toEqual({ bookmarked: true });
    expect(await bookmarks()).toBe(1);
    expect(await setBookmark({ questionId, bookmarked: false })).toEqual({ bookmarked: false });
    // A double click on "remove" must not add it back.
    expect(await setBookmark({ questionId, bookmarked: false })).toEqual({ bookmarked: false });
    expect(await bookmarks()).toBe(0);
    expect(await reportQuestion({ questionId, message: " абв " })).toEqual({
      error: PRACTICE_MESSAGES.reportTooShort,
    });
    for (let n = 0; n < 5; n += 1) {
      expect(await reportQuestion({ questionId, message: `Алдаа байна ${n}` })).toEqual({ ok: true });
    }
    expect(await reportQuestion({ questionId, message: "Зургаа дахь нь" })).toEqual({
      error: PRACTICE_MESSAGES.reportLimit,
    });
  });

  it("keeps other users out", async () => {
    const { bob } = await setup();
    const id = await start({ source: "RANDOM", count: 10 });
    const [item] = await db.attemptItem.findMany({ where: { attemptId: id } });

    signInAs(bob.clerkId);
    const bobId = await scope.userId(bob.clerkId);
    expect(await getAttemptForPlayer(id, bobId)).toBeNull();
    expect(await submitPracticeAnswer({ attemptItemId: item.id, optionId: item.optionOrder[0] })).toEqual({
      error: PRACTICE_MESSAGES.notFound,
    });
    expect(await finishPracticeAttempt(id)).toEqual({ error: PRACTICE_MESSAGES.notFound });
    expect(await createPracticeAttempt({ source: "CUSTOM", fromAttemptId: id })).toEqual({
      error: PRACTICE_MESSAGES.noQuestions,
    });
  });
});
