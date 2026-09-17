import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ANSWER_GRACE_MS } from "@/lib/quiz/exam-time";
import { subjectBreakdown } from "@/lib/quiz/exam-result";
import { PRESET_MESSAGES } from "@/lib/quiz/exam-preset";
import { createPracticeAttempt } from "@/server/actions/practice";
import { PRACTICE_MESSAGES } from "@/server/actions/practice.schemas";
import { getAttemptForPlayer, getAttemptStatus } from "@/server/queries/attempts";
import { toExamPlayerProps } from "@/server/queries/exam-player";
import { correctOptionId, TestScope } from "@/test/db/fixtures";
import { expectRedirect, redirectedId, signInAs } from "@/test/db/session";
import {
  finalizeIfExpired,
  finalizeMyExpiredExam,
  getExamClock,
  saveExamAnswer,
  startExam,
  submitExam,
  toggleReviewMark,
} from "./exam";
import { EXAM_MESSAGES } from "./exam.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const T0 = new Date("2026-09-17T02:00:00.000Z");
const MIN = 60_000;
const at = (ms: number) => new Date(T0.getTime() + ms);
const FORBIDDEN = /isCorrect|correctOptionId|explanation|Тайлбар|"result"/;

/** Two subjects (one with a pinned "Бүгд зөв", one with a locked question) and presets. */
async function setup() {
  const s1 = await scope.subject([{ pinnedLast: true }, {}, {}, {}, {}, {}], "Статистик");
  const s2 = await scope.subject([{ lockOptions: true }, {}, {}, {}, {}], "Философи");
  const byDistribution = await scope.preset({
    questionCount: 10,
    timeLimitMin: 15,
    distribution: { [s1.id]: 5, [s2.id]: 5 },
  });
  const anyFour = await scope.preset({ questionCount: 4, timeLimitMin: 1 });
  const alice = await scope.user("alice");
  const bob = await scope.user("bob");
  const setClock = scope.freezeClock(T0);
  signInAs(alice.clerkId);
  return { s1, s2, byDistribution, anyFour, alice, bob, setClock };
}

async function start(presetId: string) {
  return redirectedId(startExam(presetId), "/exam");
}

async function itemsOf(attemptId: string) {
  return db.attemptItem.findMany({
    where: { attemptId },
    orderBy: { position: "asc" },
    include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
  });
}

/** Answers the first `right` items correctly and the next `wrong` items wrongly. */
async function answer(attemptId: string, right: number, wrong: number) {
  const items = await itemsOf(attemptId);
  for (const [index, item] of items.slice(0, right + wrong).entries()) {
    const correct = await correctOptionId(item.questionId);
    const optionId = index < right ? correct : item.optionOrder.find((id) => id !== correct)!;
    const result = await saveExamAnswer({ attemptItemId: item.id, optionId });
    expect(result).not.toHaveProperty("error");
  }
  return items;
}

async function snapshot(attemptId: string, userId: string) {
  const [attempt, items, progress] = await Promise.all([
    db.attempt.findUniqueOrThrow({ where: { id: attemptId } }),
    db.attemptItem.findMany({ where: { attemptId }, orderBy: { position: "asc" } }),
    db.questionProgress.findMany({ where: { userId }, orderBy: { questionId: "asc" } }),
  ]);
  return { attempt, items, progress };
}

describe("startExam", () => {
  it("creates the exam from the distribution with persisted orders", async () => {
    const { s1, s2, byDistribution, alice } = await setup();
    const id = await start(byDistribution);

    const attempt = await db.attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt).toEqual(
      expect.objectContaining({
        mode: "EXAM",
        status: "IN_PROGRESS",
        presetId: byDistribution,
        timeLimitSec: 15 * 60,
        totalCount: 10,
        startedAt: T0,
        userId: await scope.userId(alice.clerkId),
      }),
    );
    const items = await itemsOf(id);
    expect(items.map((item) => item.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(items.filter((item) => item.question.subjectId === s1.id)).toHaveLength(5);
    expect(items.filter((item) => item.question.subjectId === s2.id)).toHaveLength(5);
    for (const item of items) {
      expect([...item.optionOrder].sort()).toEqual(item.question.options.map((o) => o.id).sort());
      expect(item.isCorrect).toBeNull();
      if (item.question.lockOptions) {
        expect(item.optionOrder).toEqual(item.question.options.map((o) => o.id));
      }
      const pinned = item.question.options.find((o) => o.pinned);
      if (pinned) expect(item.optionOrder.at(-1)).toBe(pinned.id);
    }
  });

  it("allows one open exam: concurrent starts all land on the same attempt", async () => {
    const { byDistribution, anyFour, alice } = await setup();
    const ids = await Promise.all([
      start(byDistribution),
      start(byDistribution),
      start(anyFour),
      start(byDistribution),
    ]);
    expect(new Set(ids).size).toBe(1);
    const userId = await scope.userId(alice.clerkId);
    expect(await db.attempt.count({ where: { userId, mode: "EXAM" } })).toBe(1);
    // A later start still continues the open exam.
    expect(await start(anyFour)).toBe(ids[0]);
  });

  it("explains a preset the bank cannot fill and creates nothing", async () => {
    const { s1, alice } = await setup();
    const tooBig = await scope.preset({ questionCount: 100, timeLimitMin: 90 });
    const subjectShort = await scope.preset({
      questionCount: 8,
      timeLimitMin: 10,
      distribution: { [s1.id]: 8 },
    });
    const inactive = await scope.preset({ questionCount: 2, timeLimitMin: 5, isActive: false });

    expect(await startExam(tooBig)).toEqual({ error: PRESET_MESSAGES.bankTooSmall(100, 11) });
    expect(await startExam(subjectShort)).toEqual({
      error: PRESET_MESSAGES.subjectTooSmall(s1.name, 8, 6),
    });
    expect(await startExam(inactive)).toEqual({ error: EXAM_MESSAGES.presetNotFound });
    expect(await startExam("no-such-preset")).toEqual({ error: EXAM_MESSAGES.presetNotFound });
    expect(await startExam("   ")).toEqual({ error: EXAM_MESSAGES.invalid });
    expect(await db.attempt.count({ where: { userId: await scope.userId(alice.clerkId) } })).toBe(0);

    signInAs(null);
    await expect(startExam(tooBig)).rejects.toThrow("UNAUTHENTICATED");
  });
});

describe("the exam player", () => {
  it("survives a reload with the same order and the same remaining time", async () => {
    const { byDistribution, alice, setClock } = await setup();
    const id = await start(byDistribution);
    const userId = await scope.userId(alice.clerkId);

    setClock(at(3 * MIN));
    const first = await getAttemptForPlayer(id, userId);
    const firstProps = toExamPlayerProps(first!, 4, at(3 * MIN));
    const reloaded = await getAttemptForPlayer(id, userId);
    const reloadedProps = toExamPlayerProps(reloaded!, 4, at(3 * MIN));
    expect(reloadedProps).toEqual(firstProps);

    const stored = await itemsOf(id);
    expect(first!.items.map((item) => item.options.map((o) => o.id))).toEqual(
      stored.map((item) => item.optionOrder),
    );
    const remaining = (props: typeof firstProps) =>
      Date.parse(props.deadline!) - Date.parse(props.serverNow);
    expect(firstProps.deadline).toBe(at(15 * MIN).toISOString());
    expect(remaining(firstProps)).toBe(12 * MIN);

    // Time keeps running from the stored start, not from the reload.
    setClock(at(7 * MIN));
    const later = toExamPlayerProps((await getAttemptForPlayer(id, userId))!, 4, at(7 * MIN));
    expect(later.deadline).toBe(firstProps.deadline);
    expect(remaining(later)).toBe(8 * MIN);
    expect(await getExamClock(id)).toEqual({
      deadline: at(15 * MIN).toISOString(),
      serverNow: at(7 * MIN).toISOString(),
    });
  });

  it("sends no correctness data before submit, even for answered items", async () => {
    const { byDistribution, alice } = await setup();
    const id = await start(byDistribution);
    const userId = await scope.userId(alice.clerkId);
    const items = await itemsOf(id);

    for (const item of items.slice(0, 6)) {
      const result = await saveExamAnswer({ attemptItemId: item.id, optionId: item.optionOrder[0] });
      expect(Object.keys(result)).toEqual(["serverNow"]);
    }
    const attempt = await getAttemptForPlayer(id, userId);
    for (const index of attempt!.items.keys()) {
      expect(JSON.stringify(toExamPlayerProps(attempt!, index, T0))).not.toMatch(FORBIDDEN);
    }
    // Nothing is graded or scheduled while the exam runs.
    const stored = await db.attemptItem.findMany({ where: { attemptId: id } });
    expect(stored.every((item) => item.isCorrect === null)).toBe(true);
    expect(await db.questionProgress.count({ where: { userId } })).toBe(0);
    // And the result is not served for a running exam.
    expect(await getAttemptStatus(id, userId)).toEqual(
      expect.objectContaining({ status: "IN_PROGRESS" }),
    );
  });

  it("lets answers change and clear, marks for review, and rejects foreign options", async () => {
    const { byDistribution } = await setup();
    const id = await start(byDistribution);
    const [first, second] = await itemsOf(id);

    await saveExamAnswer({ attemptItemId: first.id, optionId: first.optionOrder[0] });
    await saveExamAnswer({ attemptItemId: first.id, optionId: first.optionOrder[2] });
    let stored = await db.attemptItem.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.selectedOptionId).toBe(first.optionOrder[2]);
    expect(stored.answeredAt).toEqual(T0);

    await saveExamAnswer({ attemptItemId: first.id, optionId: null });
    stored = await db.attemptItem.findUniqueOrThrow({ where: { id: first.id } });
    expect(stored.selectedOptionId).toBeNull();
    expect(stored.answeredAt).toBeNull();

    expect(await saveExamAnswer({ attemptItemId: first.id, optionId: second.optionOrder[0] })).toEqual({
      error: EXAM_MESSAGES.invalid,
    });

    expect(await toggleReviewMark(first.id)).toEqual({ flagged: true });
    const [a, b] = await Promise.all([toggleReviewMark(second.id), toggleReviewMark(second.id)]);
    expect([a, b]).toEqual(expect.arrayContaining([{ flagged: true }, { flagged: false }]));
    expect(await toggleReviewMark(first.id)).toEqual({ flagged: false });
  });

  it("rejects an answer saved after the deadline (moved clock)", async () => {
    const { anyFour, setClock } = await setup();
    const id = await start(anyFour);
    const [item] = await itemsOf(id);
    const deadline = at(1 * MIN);

    setClock(new Date(deadline.getTime() + ANSWER_GRACE_MS - 1000));
    expect(await saveExamAnswer({ attemptItemId: item.id, optionId: item.optionOrder[0] })).toHaveProperty(
      "serverNow",
    );

    setClock(new Date(deadline.getTime() + ANSWER_GRACE_MS + 1000));
    expect(await saveExamAnswer({ attemptItemId: item.id, optionId: item.optionOrder[1] })).toEqual({
      error: EXAM_MESSAGES.timeUp,
      closed: true,
    });
    expect(await toggleReviewMark(item.id)).toEqual({ error: EXAM_MESSAGES.timeUp, closed: true });
    const stored = await db.attemptItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.selectedOptionId).toBe(item.optionOrder[0]);
  });
});

describe("finishing", () => {
  it("finalizes an expired exam on load, grading only what was answered", async () => {
    const { byDistribution, alice, setClock } = await setup();
    const id = await start(byDistribution);
    const userId = await scope.userId(alice.clerkId);
    await answer(id, 2, 1);

    // Inside the grace period nothing happens yet.
    setClock(at(15 * MIN + ANSWER_GRACE_MS));
    expect(await finalizeIfExpired(id)).toEqual({ status: "IN_PROGRESS" });

    setClock(at(15 * MIN + ANSWER_GRACE_MS + 1));
    expect(await finalizeIfExpired(id)).toEqual({ status: "EXPIRED" });
    const attempt = await db.attempt.findUniqueOrThrow({ where: { id } });
    expect(attempt).toEqual(
      expect.objectContaining({ status: "EXPIRED", correctCount: 2, submittedAt: at(15 * MIN) }),
    );
    const items = await db.attemptItem.findMany({ where: { attemptId: id } });
    expect(items.filter((item) => item.isCorrect === true)).toHaveLength(2);
    expect(items.filter((item) => item.isCorrect === false)).toHaveLength(8);
    const progress = await db.questionProgress.findMany({ where: { userId } });
    expect(progress).toHaveLength(3);
    expect(progress.map((row) => row.lastAnsweredAt)).toEqual([at(15 * MIN), at(15 * MIN), at(15 * MIN)]);

    // Loading again changes nothing, and a new exam can start.
    expect(await finalizeIfExpired(id)).toEqual({ status: "EXPIRED" });
    const next = await start(byDistribution);
    expect(next).not.toBe(id);
  });

  it("finalizes the user's expired open exam before listing pages show it", async () => {
    const { anyFour, alice, setClock } = await setup();
    const id = await start(anyFour);
    setClock(at(10 * MIN));
    await finalizeMyExpiredExam();
    expect(await db.attempt.findUniqueOrThrow({ where: { id } })).toEqual(
      expect.objectContaining({ status: "EXPIRED", submittedAt: at(1 * MIN), correctCount: 0 }),
    );
    // No open exam: nothing to do.
    await finalizeMyExpiredExam();
    expect(await db.attempt.count({ where: { userId: await scope.userId(alice.clerkId) } })).toBe(1);
  });

  it("submits once: grades, updates progress, and a second submit changes nothing", async () => {
    const { byDistribution, alice, setClock } = await setup();
    const id = await start(byDistribution);
    const userId = await scope.userId(alice.clerkId);
    await answer(id, 3, 2);

    setClock(at(9 * MIN));
    expect(await expectRedirect(submitExam(id))).toBe(`/exam/${id}/result`);
    const before = await snapshot(id, userId);
    expect(before.attempt).toEqual(
      expect.objectContaining({ status: "SUBMITTED", correctCount: 3, submittedAt: at(9 * MIN) }),
    );
    expect(before.items.every((item) => item.isCorrect !== null)).toBe(true);
    expect(before.progress).toHaveLength(5);
    expect(before.progress.reduce((sum, row) => sum + row.correctCount, 0)).toBe(3);
    expect(before.progress.reduce((sum, row) => sum + row.wrongCount, 0)).toBe(2);

    setClock(at(10 * MIN));
    expect(await expectRedirect(submitExam(id))).toBe(`/exam/${id}/result`);
    await Promise.all([expectRedirect(submitExam(id)), expectRedirect(submitExam(id))]);
    expect(await snapshot(id, userId)).toEqual(before);

    expect(await saveExamAnswer({ attemptItemId: before.items[9].id, optionId: before.items[9].optionOrder[0] })).toEqual({
      error: EXAM_MESSAGES.closed,
      closed: true,
    });
    expect(await toggleReviewMark(before.items[9].id)).toEqual({
      error: EXAM_MESSAGES.closed,
      closed: true,
    });
  });

  it("finalizes a submit after the grace period as EXPIRED", async () => {
    const { anyFour, setClock } = await setup();
    const id = await start(anyFour);
    setClock(at(1 * MIN + ANSWER_GRACE_MS + 5000));
    await expectRedirect(submitExam(id));
    expect(await db.attempt.findUniqueOrThrow({ where: { id } })).toEqual(
      expect.objectContaining({ status: "EXPIRED", submittedAt: at(1 * MIN) }),
    );
  });

  it("never saves an answer after grading, even when racing the submit", async () => {
    const { byDistribution } = await setup();
    const id = await start(byDistribution);
    const items = await itemsOf(id);

    const saves = items.map(async (item) =>
      saveExamAnswer({ attemptItemId: item.id, optionId: await correctOptionId(item.questionId) }),
    );
    const results = await Promise.allSettled([...saves, expectRedirect(submitExam(id))]);
    expect(results.filter((result) => result.status === "rejected")).toEqual([]);

    const graded = await itemsOf(id);
    const attempt = await db.attempt.findUniqueOrThrow({ where: { id } });
    let correct = 0;
    for (const item of graded) {
      const right = item.question.options.find((o) => o.isCorrect)!.id;
      // Graded exactly as stored: no answer arrived after grading.
      expect(item.isCorrect).toBe(item.selectedOptionId === right);
      if (item.isCorrect) correct += 1;
    }
    expect(attempt.correctCount).toBe(correct);
  });

  it("reports per-subject numbers that add up to the total, and retries the misses", async () => {
    const { s1, s2, byDistribution, alice } = await setup();
    const id = await start(byDistribution);
    const userId = await scope.userId(alice.clerkId);
    await answer(id, 4, 3);
    await expectRedirect(submitExam(id));

    const result = await getAttemptForPlayer(id, userId);
    expect(result!.items.every((item) => item.result !== null)).toBe(true);
    const { rows, total } = subjectBreakdown(
      result!.items.map((item) => ({
        subjectName: item.subjectName,
        answered: item.selectedOptionId !== null,
        isCorrect: item.result!.isCorrect,
      })),
    );
    expect(rows.map((row) => [row.subject, row.total])).toEqual(
      [[s1.name, 5], [s2.name, 5]].sort((a, b) => String(a[0]).localeCompare(String(b[0]), "mn")),
    );
    expect(rows.reduce((sum, row) => sum + row.correct, 0)).toBe(total.correct);
    expect(rows.reduce((sum, row) => sum + row.answered, 0)).toBe(total.answered);
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(total.total);
    expect(total).toEqual(expect.objectContaining({ correct: 4, answered: 7, total: 10, percent: 40 }));
    expect((await db.attempt.findUniqueOrThrow({ where: { id } })).correctCount).toBe(total.correct);

    // "Алдсануудаа дадлага болгох": wrong and unanswered items, as a practice.
    const practiceId = await redirectedId(
      createPracticeAttempt({ source: "CUSTOM", fromAttemptId: id }),
      "/practice",
    );
    const retry = await db.attemptItem.findMany({ where: { attemptId: practiceId } });
    const missed = result!.items.filter((item) => !item.result!.isCorrect).map((item) => item.questionId);
    expect(retry.map((item) => item.questionId).sort()).toEqual([...missed].sort());
    expect(retry).toHaveLength(6);
  });
});

describe("ownership", () => {
  it("keeps other users from seeing or changing the exam", async () => {
    const { byDistribution, alice, bob } = await setup();
    const id = await start(byDistribution);
    const aliceId = await scope.userId(alice.clerkId);
    const before = await snapshot(id, aliceId);
    const [item] = before.items;

    signInAs(bob.clerkId);
    await startExam(byDistribution).catch(() => undefined); // creates Bob's own user and exam
    const bobId = await scope.userId(bob.clerkId);
    expect(await getAttemptForPlayer(id, bobId)).toBeNull();
    expect(await getAttemptStatus(id, bobId)).toBeNull();
    expect(await saveExamAnswer({ attemptItemId: item.id, optionId: item.optionOrder[0] })).toEqual({
      error: EXAM_MESSAGES.notFound,
    });
    expect(await toggleReviewMark(item.id)).toEqual({ error: EXAM_MESSAGES.notFound });
    expect(await submitExam(id)).toEqual({ error: EXAM_MESSAGES.notFound });
    expect(await finalizeIfExpired(id)).toBeNull();
    expect(await getExamClock(id)).toEqual({ error: EXAM_MESSAGES.notFound });
    expect(await createPracticeAttempt({ source: "CUSTOM", fromAttemptId: id })).toEqual({
      error: PRACTICE_MESSAGES.noQuestions,
    });

    expect(await snapshot(id, aliceId)).toEqual(before);
    // Bob's start created his own exam, not a link to Alice's.
    const bobs = await db.attempt.findMany({ where: { userId: bobId } });
    expect(bobs.every((attempt) => attempt.id !== id)).toBe(true);
  });
});
