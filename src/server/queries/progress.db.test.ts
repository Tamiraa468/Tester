import { afterEach, describe, expect, it } from "vitest";
import { AttemptMode, AttemptSource } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { ubDayKey } from "@/lib/date";
import { createPracticeAttempt, setBookmark, submitPracticeAnswer } from "@/server/actions/practice";
import { startExam, submitExam } from "@/server/actions/exam";
import { correctOptionId, TestScope } from "@/test/db/fixtures";
import { redirectedId, signInAs } from "@/test/db/session";
import {
  getActivity,
  getBankStats,
  getDashboardData,
  getReviewCounts,
  getSubjectStats,
  isNewUser,
  listRecentAttempts,
  listReviewQuestions,
  REVIEW_PAGE_SIZE,
} from "./progress";

const scope = new TestScope();
afterEach(() => scope.cleanup());

// Three Mongolian days. The last one is 07:00 in Ulaanbaatar but 23:00 UTC on the
// PREVIOUS day: the server runs in UTC, and the answer still belongs to the 17th.
const DAY_1 = new Date("2026-09-15T04:00:00.000Z"); // 12:00, 15-нд
const DAY_2 = new Date("2026-09-16T04:00:00.000Z"); // 12:00, 16-нд
const DAY_3 = new Date("2026-09-16T23:00:00.000Z"); // 07:00, 17-нд
const TODAY = "2026-09-17";

/** Answers one question of an attempt, right or wrong on purpose. */
async function answer(attemptId: string, questionId: string, correct: boolean) {
  const item = await db.attemptItem.findFirstOrThrow({ where: { attemptId, questionId } });
  const right = await correctOptionId(questionId);
  const optionId = correct ? right : item.optionOrder.find((id) => id !== right)!;
  const result = await submitPracticeAnswer({ attemptItemId: item.id, optionId });
  expect(result).toMatchObject({ isCorrect: correct });
}

const startPractice = (subjectId: string) =>
  redirectedId(
    createPracticeAttempt({ source: AttemptSource.RANDOM, subjectId, count: 50 }),
    "/practice",
  );

/**
 * Two subjects and a fixed answer history, so every figure below is known:
 *
 *   А: a0 ✓✓✓ (box 3, mastered)  a1 ✓  a2 ✗  a3, a4 untouched  (5 active)
 *   Б: b0 ✓  b1 ✗  b2 ✓                                        (3 active + 1 inactive)
 */
async function setup() {
  const a = await scope.subject(5, "Математик");
  const b = await scope.subject([{}, {}, {}, { isActive: false }], "Философи");
  const alice = await scope.user("alice", { create: true });
  const setClock = scope.freezeClock(DAY_1);
  signInAs(alice.clerkId);
  const userId = alice.id!;

  // 15-нд: three answers in subject А.
  const first = await startPractice(a.id);
  await answer(first, a.questionIds[0], true);
  await answer(first, a.questionIds[1], true);
  await answer(first, a.questionIds[2], false);

  // 16-нд: one more in А, and all three active questions of Б.
  setClock(DAY_2);
  const second = await startPractice(a.id);
  await answer(second, a.questionIds[0], true);
  const third = await startPractice(b.id);
  await answer(third, b.questionIds[0], true);
  await answer(third, b.questionIds[1], false);
  await answer(third, b.questionIds[2], true);

  // 17-нд, 07:00 Улаанбаатарын цагаар: a0 reaches box 3 and counts as mastered.
  setClock(DAY_3);
  const fourth = await startPractice(a.id);
  await answer(fourth, a.questionIds[0], true);

  return { a, b, alice, userId, setClock };
}

describe("dashboard figures", () => {
  it("counts the bank: active questions, seen, mastered and accuracy", async () => {
    const { userId } = await setup();

    // 5 active in А + 3 active in Б; the inactive question counts nowhere.
    // 8 graded answers: 6 correct (a0 ×3, a1, b0, b2) and 2 wrong (a2, b1).
    expect(await getBankStats(userId)).toEqual({
      total: 8,
      seen: 6,
      mastered: 1,
      answered: 8,
      correct: 6,
      accuracy: 0.75,
    });
  });

  it("counts per subject, weakest first, and skips subjects without active questions", async () => {
    const { a, b, userId } = await setup();
    await scope.subject([{ isActive: false }], "Хоосон");

    const subjects = await getSubjectStats(userId);
    expect(subjects.map((subject) => subject.subjectId)).toEqual([b.id, a.id]);
    // Б has nothing mastered, so it sorts ahead of А (1 of 5 mastered).
    expect(subjects[0]).toEqual({
      subjectId: b.id,
      subjectName: b.name,
      total: 3,
      seen: 3,
      mastered: 0,
      answered: 3,
      correct: 2,
      accuracy: 2 / 3,
    });
    expect(subjects[1]).toEqual({
      subjectId: a.id,
      subjectName: a.name,
      total: 5,
      seen: 3,
      mastered: 1,
      answered: 5,
      correct: 4,
      accuracy: 0.8,
    });
  });

  it("matches the review counts a practice would actually draw on", async () => {
    const { a, b, userId } = await setup();
    await setBookmark({ questionId: a.questionIds[3], bookmarked: true });
    await setBookmark({ questionId: b.questionIds[0], bookmarked: true });

    // Due on the 17th at 07:00: a1 and a2 (answered on the 15th) and b1 (box 0, due
    // ten minutes later). a0 is in box 3 (+7 days), b0 and b2 in box 1 (+1 day).
    expect(await getReviewCounts(userId)).toEqual({
      DUE: 3,
      WRONG: 2,
      BOOKMARKED: 2,
    });
  });

  it("counts an answer at 07:00 Ulaanbaatar on that day and builds the streak", async () => {
    const { userId } = await setup();
    const activity = await getActivity(userId);

    expect(activity.today).toBe(TODAY);
    expect(ubDayKey(DAY_3)).toBe(TODAY);
    expect(activity.days).toHaveLength(30);
    expect(activity.days.at(-1)).toEqual({ day: "2026-09-17", total: 1, correct: 1 });
    expect(activity.days.at(-2)).toEqual({ day: "2026-09-16", total: 4, correct: 3 });
    expect(activity.days.at(-3)).toEqual({ day: "2026-09-15", total: 3, correct: 2 });
    expect(activity.days.at(-4)).toEqual({ day: "2026-09-14", total: 0, correct: 0 });
    expect(activity.days[0]).toEqual({ day: "2026-08-19", total: 0, correct: 0 });
    expect(activity.streak).toBe(3);
  });

  it("keeps a streak that ends yesterday and drops one that ends earlier", async () => {
    const { setClock, userId } = await setup();

    // 18-нд: nothing answered yet today, the streak still stands.
    setClock(new Date("2026-09-17T23:00:00.000Z"));
    expect((await getActivity(userId)).today).toBe("2026-09-18");
    expect((await getActivity(userId)).streak).toBe(3);

    // 19-нд: the last answer is now the day before yesterday.
    setClock(new Date("2026-09-18T23:00:00.000Z"));
    expect((await getActivity(userId)).streak).toBe(0);
  });

  it("lists the last finished attempts of both modes, newest first", async () => {
    const { a, alice, setClock, userId } = await setup();
    const presetId = await scope.preset({ questionCount: 4, timeLimitMin: 30 });

    const examId = await redirectedId(startExam(presetId), "/exam");
    await submitExam(examId).catch(() => {});

    const recent = await listRecentAttempts(userId);
    expect(recent[0]).toMatchObject({ id: examId, mode: AttemptMode.EXAM, totalCount: 4 });
    // A practice counts as finished only once it is closed, so the four still open
    // from the setup are not listed.
    expect(recent).toHaveLength(1);

    // A closed practice joins the list, labelled with its source and subject.
    setClock(new Date(DAY_3.getTime() + 60_000));
    const practiceId = await redirectedId(
      createPracticeAttempt({ source: AttemptSource.RANDOM, subjectId: a.id, count: 10 }),
      "/practice",
    );
    const { finishPracticeAttempt } = await import("@/server/actions/practice");
    await finishPracticeAttempt(practiceId).catch(() => {});

    const after = await listRecentAttempts(userId);
    expect(after.map((attempt) => attempt.id)).toEqual([practiceId, examId]);
    expect(after[0]).toMatchObject({
      mode: AttemptMode.PRACTICE,
      source: AttemptSource.RANDOM,
      subjectName: a.name,
      presetName: null,
    });
    expect(after[1].presetName).toMatch(/Шалгалт/);
    signInAs(alice.clerkId);
  });

  it("shows a brand-new user the empty state", async () => {
    await setup();
    const newcomer = await scope.user("newcomer", { create: true });
    signInAs(newcomer.clerkId);

    const data = await getDashboardData(newcomer.id!);
    expect(isNewUser(data)).toBe(true);
    expect(data.bank).toEqual({
      total: 8,
      seen: 0,
      mastered: 0,
      answered: 0,
      correct: 0,
      accuracy: null,
    });
    expect(data.subjects.every((subject) => subject.seen === 0)).toBe(true);
    expect(data.subjects.every((subject) => subject.accuracy === null)).toBe(true);
    expect(data.reviewCounts).toEqual({ DUE: 0, WRONG: 0, BOOKMARKED: 0 });
    expect(data.recentAttempts).toEqual([]);
    expect(data.activity.streak).toBe(0);
    expect(data.activity.days).toHaveLength(30);
    expect(data.activity.days.every((day) => day.total === 0)).toBe(true);
  });

  it("keeps one user's figures out of another's", async () => {
    const { userId } = await setup();
    const bob = await scope.user("bob", { create: true });

    expect((await getBankStats(bob.id!)).seen).toBe(0);
    expect((await getActivity(bob.id!)).streak).toBe(0);
    expect((await listRecentAttempts(bob.id!))).toEqual([]);
    // Alice's own figures are untouched.
    expect((await getBankStats(userId)).seen).toBe(6);
  });
});

describe("listReviewQuestions", () => {
  it("lists each tab in the order a practice would pick, and only question text", async () => {
    const { a, b, userId } = await setup();

    const due = await listReviewQuestions(userId, AttemptSource.DUE);
    expect(due.total).toBe(3);
    expect(due.pageCount).toBe(1);
    // Most overdue first: a2 (box 0, due on the 15th), then a1, then b1.
    expect(due.items.map((item) => item.id)).toEqual([
      a.questionIds[2],
      a.questionIds[1],
      b.questionIds[1],
    ]);

    const wrong = await listReviewQuestions(userId, AttemptSource.WRONG);
    expect(wrong.total).toBe(2);
    expect(wrong.items.map((item) => item.id)).toEqual([a.questionIds[2], b.questionIds[1]]);
    expect(wrong.items[0]).toMatchObject({
      subjectName: a.name,
      wrongCount: 1,
      box: 0,
      bookmarkedAt: null,
    });

    // Nothing that could reveal an answer is selected.
    expect(JSON.stringify(due.items)).not.toMatch(/isCorrect|options|Тайлбар|Хариулт/);
  });

  it("counts and lists bookmarks newest first, and never shows an inactive question", async () => {
    const { b, userId } = await setup();
    // The fourth question of Б is inactive: countsBySource excludes it, so the list must too.
    await setBookmark({ questionId: b.questionIds[3], bookmarked: true });
    await setBookmark({ questionId: b.questionIds[0], bookmarked: true });

    const page = await listReviewQuestions(userId, AttemptSource.BOOKMARKED);
    expect(await getReviewCounts(userId)).toMatchObject({ BOOKMARKED: page.total });
    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.id)).toEqual([b.questionIds[0]]);
    expect(page.items[0].bookmarkedAt).not.toBeNull();
  });

  it("pages, and clamps a page that does not exist", async () => {
    const { userId } = await setup();
    const big = await scope.subject(REVIEW_PAGE_SIZE + 5, "Их сэдэв");
    for (const questionId of big.questionIds) {
      await setBookmark({ questionId, bookmarked: true });
    }

    const first = await listReviewQuestions(userId, AttemptSource.BOOKMARKED, 1);
    expect(first.total).toBe(REVIEW_PAGE_SIZE + 5);
    expect(first.pageCount).toBe(2);
    expect(first.items).toHaveLength(REVIEW_PAGE_SIZE);

    const second = await listReviewQuestions(userId, AttemptSource.BOOKMARKED, 2);
    expect(second.page).toBe(2);
    expect(second.items).toHaveLength(5);
    // No question appears on both pages.
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(REVIEW_PAGE_SIZE + 5);

    // Out of range in either direction lands on a page that exists.
    expect((await listReviewQuestions(userId, AttemptSource.BOOKMARKED, 99)).page).toBe(2);
    expect((await listReviewQuestions(userId, AttemptSource.BOOKMARKED, 0)).page).toBe(1);
  });
});
