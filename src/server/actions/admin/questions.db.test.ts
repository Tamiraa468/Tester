import { afterEach, describe, expect, it } from "vitest";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { QUESTION_MESSAGES } from "@/lib/import/question-schema";
import { TestScope } from "@/test/db/fixtures";
import { signInAs } from "@/test/db/session";
import { getAdminQuestion } from "@/server/queries/admin/questions";
import {
  createQuestion,
  previewOptionOrders,
  setQuestionActive,
  updateQuestion,
} from "./questions";
import { ADMIN_MESSAGES } from "./questions.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const NOW = new Date("2026-09-17T04:00:00.000Z");

const option = (text: string, isCorrect = false, pinned = false) => ({ text, isCorrect, pinned });

async function setup() {
  const subject = await scope.subject(0, "Админ");
  const admin = await scope.user("admin", { create: true });
  const member = await scope.user("member", { create: true });
  scope.freezeClock(NOW);
  signInAs(admin.clerkId, { admin: true });
  return { subject, admin, member };
}

/** A question created through the form, returned with its option ids. */
async function createViaForm(subjectId: string, code: string) {
  const result = await createQuestion({
    code,
    subjectId,
    text: "Судалгааны таамаглал гэж юу вэ?",
    imageUrl: "",
    explanation: "Тайлбар",
    lockOptions: false,
    options: [option("Нэгдүгээр"), option("Хоёрдугаар", true), option("Гуравдугаар")],
  });
  expect(result).toHaveProperty("questionId");
  const { questionId } = result as { questionId: string };
  // The action created it, so the scope has to be told to clean it up.
  scope.trackQuestion(questionId);
  return (await getAdminQuestion(questionId))!;
}

/** One graded practice answer, so the question counts as having attempt history. */
async function recordAttempt(userId: string, questionId: string, optionId: string) {
  const options = await db.option.findMany({
    where: { questionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  await db.attempt.create({
    data: {
      userId,
      mode: AttemptMode.PRACTICE,
      source: AttemptSource.RANDOM,
      status: AttemptStatus.SUBMITTED,
      totalCount: 1,
      correctCount: 1,
      startedAt: NOW,
      submittedAt: NOW,
      items: {
        create: [
          {
            questionId,
            position: 0,
            optionOrder: options.map((row) => row.id),
            selectedOptionId: optionId,
            isCorrect: true,
            answeredAt: NOW,
          },
        ],
      },
    },
  });
  await db.questionProgress.create({
    data: {
      userId,
      questionId,
      box: 4,
      correctCount: 4,
      wrongCount: 1,
      lastAnsweredAt: NOW,
      nextReviewAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });
}

describe("admin question actions", () => {
  it("refuses everyone who is not an admin", async () => {
    const { subject, member } = await setup();
    const question = await createViaForm(subject.id, "ADM-AUTH");
    const body = {
      questionId: question.id,
      subjectId: subject.id,
      text: "Өөрчилсөн",
      imageUrl: "",
      explanation: "",
      lockOptions: false,
      options: [option("Нэг", true), option("Хоёр")],
    };

    signInAs(null);
    await expect(createQuestion({ code: "X", ...body })).rejects.toThrow("UNAUTHENTICATED");
    await expect(updateQuestion(body)).rejects.toThrow("UNAUTHENTICATED");
    await expect(setQuestionActive({ questionId: question.id, isActive: false })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(previewOptionOrders({ lockOptions: false, options: [] })).rejects.toThrow(
      "UNAUTHENTICATED",
    );

    // Signed in, but without the admin role: requireAdmin() redirects to /dashboard.
    signInAs(member.clerkId);
    await expect(createQuestion({ code: "X", ...body })).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateQuestion(body)).rejects.toThrow("NEXT_REDIRECT");
    await expect(setQuestionActive({ questionId: question.id, isActive: false })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    await expect(
      previewOptionOrders({ lockOptions: false, options: [option("а", true)] }),
    ).rejects.toThrow("NEXT_REDIRECT");

    // Nothing changed.
    expect(await getAdminQuestion(question.id)).toMatchObject({ text: question.text });
  });

  it("creates a question, normalizing text and numbering the options", async () => {
    const { subject } = await setup();
    const created = await createQuestion({
      code: "  ADM-001 ",
      subjectId: subject.id,
      text: "  Асуулт  нэг  ",
      imageUrl: "",
      explanation: "",
      lockOptions: false,
      options: [option(" Нэг "), option("Хоёр", true), option("Бүгд зөв", false, true)],
    });
    const { questionId } = created as { questionId: string };
    scope.trackQuestion(questionId);
    const question = (await getAdminQuestion(questionId))!;

    expect(question.code).toBe("ADM-001");
    expect(question.text).toBe("Асуулт нэг");
    expect(question.explanation).toBe("");
    expect(question.imageUrl).toBe("");
    expect(question.options.map((row) => [row.text, row.isCorrect, row.pinned, row.sortOrder])).toEqual([
      ["Нэг", false, false, 0],
      ["Хоёр", true, false, 1],
      ["Бүгд зөв", false, true, 2],
    ]);
    // An empty optional field is stored as NULL, not as "".
    const raw = await db.question.findUniqueOrThrow({ where: { id: questionId } });
    expect(raw.explanation).toBeNull();
    expect(raw.imageUrl).toBeNull();
  });

  it("rejects a duplicate code, a missing or double correct option and too few options", async () => {
    const { subject } = await setup();
    await createViaForm(subject.id, "ADM-DUP");

    const base = {
      subjectId: subject.id,
      text: "Асуулт",
      imageUrl: "",
      explanation: "",
      lockOptions: false,
    };
    expect(
      await createQuestion({
        code: "ADM-DUP",
        ...base,
        options: [option("а", true), option("б")],
      }),
    ).toEqual({ error: ADMIN_MESSAGES.duplicateCode("ADM-DUP") });

    expect(
      await createQuestion({ code: "ADM-X1", ...base, options: [option("а"), option("б")] }),
    ).toEqual({ error: QUESTION_MESSAGES.oneCorrect });

    expect(
      await createQuestion({
        code: "ADM-X2",
        ...base,
        options: [option("а", true), option("б", true)],
      }),
    ).toEqual({ error: QUESTION_MESSAGES.oneCorrect });

    expect(
      await createQuestion({ code: "ADM-X3", ...base, options: [option("а", true)] }),
    ).toEqual({ error: QUESTION_MESSAGES.tooFewOptions });

    expect(
      await createQuestion({
        code: "ADM-X4",
        ...base,
        imageUrl: "зураг.png",
        options: [option("а", true), option("б")],
      }),
    ).toEqual({ error: QUESTION_MESSAGES.imageUrl });

    expect(await db.question.count({ where: { code: { startsWith: "ADM-X" } } })).toBe(0);
  });

  it("keeps every option id when rows are reordered", async () => {
    const { subject } = await setup();
    const question = await createViaForm(subject.id, "ADM-MOVE");
    const [first, second, third] = question.options;

    const result = await updateQuestion({
      questionId: question.id,
      subjectId: subject.id,
      text: question.text,
      imageUrl: "",
      explanation: question.explanation,
      lockOptions: false,
      // The correct option (second) is moved to the front; nothing else changes.
      options: [
        { optionId: second.id, text: second.text, isCorrect: true, pinned: false },
        { optionId: first.id, text: first.text, isCorrect: false, pinned: false },
        { optionId: third.id, text: third.text, isCorrect: false, pinned: false },
      ],
    });
    expect(result).toEqual({ ok: true, resetUsers: 0 });

    const after = (await getAdminQuestion(question.id))!;
    // Same ids, same texts, new positions: an AttemptItem.optionOrder stays valid.
    expect(after.options.map((row) => [row.id, row.text, row.sortOrder])).toEqual([
      [second.id, second.text, 0],
      [first.id, first.text, 1],
      [third.id, third.text, 2],
    ]);
  });

  it("adds and removes options, but never removes one a user has answered", async () => {
    const { subject, member } = await setup();
    const question = await createViaForm(subject.id, "ADM-OPTS");
    const [first, second, third] = question.options;
    const keep = (id: string, text: string, isCorrect = false) => ({
      optionId: id,
      text,
      isCorrect,
      pinned: false,
    });
    const body = {
      questionId: question.id,
      subjectId: subject.id,
      text: question.text,
      imageUrl: "",
      explanation: "",
      lockOptions: false,
    };

    // No attempts yet: dropping the third option is allowed, and a new one is added.
    expect(
      await updateQuestion({
        ...body,
        options: [
          keep(first.id, first.text),
          keep(second.id, second.text, true),
          { optionId: null, text: "Дөрөвдүгээр", isCorrect: false, pinned: false },
        ],
      }),
    ).toEqual({ ok: true, resetUsers: 0 });

    let after = (await getAdminQuestion(question.id))!;
    expect(after.options.map((row) => row.text)).toEqual([
      first.text,
      second.text,
      "Дөрөвдүгээр",
    ]);
    expect(await db.option.findUnique({ where: { id: third.id } })).toBeNull();

    // Once someone has answered it, the option list may only grow.
    await recordAttempt(member.id!, question.id, second.id);
    expect(
      await updateQuestion({
        ...body,
        options: [keep(first.id, first.text), keep(second.id, second.text, true)],
      }),
    ).toEqual({ error: ADMIN_MESSAGES.cannotDeleteOptions });

    after = (await getAdminQuestion(question.id))!;
    expect(after.options).toHaveLength(3);
    expect(after.attemptCount).toBe(1);
  });

  it("refuses an option id belonging to another question", async () => {
    const { subject } = await setup();
    const mine = await createViaForm(subject.id, "ADM-OWN-1");
    const other = await createViaForm(subject.id, "ADM-OWN-2");

    expect(
      await updateQuestion({
        questionId: mine.id,
        subjectId: subject.id,
        text: mine.text,
        imageUrl: "",
        explanation: "",
        lockOptions: false,
        options: [
          { optionId: other.options[0].id, text: "Хулгайлсан", isCorrect: true, pinned: false },
          { optionId: mine.options[1].id, text: "Хоёр", isCorrect: false, pinned: false },
        ],
      }),
    ).toEqual({ error: ADMIN_MESSAGES.unknownOption });

    expect((await getAdminQuestion(other.id))!.options[0].text).toBe(other.options[0].text);
  });

  it("asks before changing the correct answer, then resets everyone's progress", async () => {
    const { subject, member } = await setup();
    const question = await createViaForm(subject.id, "ADM-KEY");
    const [first, second, third] = question.options;
    await recordAttempt(member.id!, question.id, second.id);

    const body = {
      questionId: question.id,
      subjectId: subject.id,
      text: question.text,
      imageUrl: "",
      explanation: "",
      lockOptions: false,
    };
    const rows = (correctId: string) =>
      [first, second, third].map((row) => ({
        optionId: row.id,
        text: row.text,
        isCorrect: row.id === correctId,
        pinned: false,
      }));

    // First attempt: the admin is told how many users this touches, nothing is written.
    expect(await updateQuestion({ ...body, options: rows(third.id) })).toEqual({
      needsConfirmation: { affectedUsers: 1 },
    });
    expect((await getAdminQuestion(question.id))!.options[1].isCorrect).toBe(true);

    // Editing something else on the same question still needs no confirmation.
    expect(
      await updateQuestion({ ...body, text: "Шинэ текст", options: rows(second.id) }),
    ).toEqual({ ok: true, resetUsers: 0 });
    expect(await db.questionProgress.findFirstOrThrow({ where: { questionId: question.id } })).toMatchObject(
      { box: 4 },
    );

    // Confirmed: the key moves and every user's schedule for this question restarts.
    expect(
      await updateQuestion({ ...body, options: rows(third.id), confirmAnswerChange: true }),
    ).toEqual({ ok: true, resetUsers: 1 });

    const after = (await getAdminQuestion(question.id))!;
    expect(after.options.map((row) => row.isCorrect)).toEqual([false, false, true]);

    const progress = await db.questionProgress.findFirstOrThrow({
      where: { questionId: question.id },
    });
    expect(progress.box).toBe(0);
    expect(progress.nextReviewAt).toEqual(NOW);
    // History is history: the counts and the graded attempt are untouched.
    expect(progress.correctCount).toBe(4);
    expect(progress.wrongCount).toBe(1);
    const item = await db.attemptItem.findFirstOrThrow({ where: { questionId: question.id } });
    expect(item.isCorrect).toBe(true);
    expect(item.selectedOptionId).toBe(second.id);
  });

  it("does not reset anything when the correct option only changes its text", async () => {
    const { subject, member } = await setup();
    const question = await createViaForm(subject.id, "ADM-TEXT");
    const [first, second, third] = question.options;
    await recordAttempt(member.id!, question.id, second.id);

    expect(
      await updateQuestion({
        questionId: question.id,
        subjectId: subject.id,
        text: question.text,
        imageUrl: "",
        explanation: "",
        lockOptions: false,
        options: [
          { optionId: first.id, text: first.text, isCorrect: false, pinned: false },
          { optionId: second.id, text: "Зассан зөв хариулт", isCorrect: true, pinned: false },
          { optionId: third.id, text: third.text, isCorrect: false, pinned: false },
        ],
      }),
    ).toEqual({ ok: true, resetUsers: 0 });

    expect(await db.questionProgress.findFirstOrThrow({ where: { questionId: question.id } })).toMatchObject(
      { box: 4 },
    );
  });

  it("cannot change the code of an existing question", async () => {
    const { subject } = await setup();
    const question = await createViaForm(subject.id, "ADM-CODE");

    const withCode = {
      questionId: question.id,
      code: "ADM-CODE-NEW",
      subjectId: subject.id,
      text: question.text,
      imageUrl: "",
      explanation: "",
      lockOptions: false,
      options: [option("Нэг", true), option("Хоёр")],
    };
    // The update schema has no `code` field at all, so a stray one is rejected outright.
    expect(await updateQuestion(withCode as never)).toEqual({ error: ADMIN_MESSAGES.invalid });
    expect((await getAdminQuestion(question.id))!.code).toBe("ADM-CODE");
  });

  it("activates and deactivates a question idempotently", async () => {
    const { subject } = await setup();
    const question = await createViaForm(subject.id, "ADM-ACT");

    expect(await setQuestionActive({ questionId: question.id, isActive: false })).toEqual({
      isActive: false,
    });
    expect(await setQuestionActive({ questionId: question.id, isActive: false })).toEqual({
      isActive: false,
    });
    expect((await getAdminQuestion(question.id))!.isActive).toBe(false);

    expect(await setQuestionActive({ questionId: question.id, isActive: true })).toEqual({
      isActive: true,
    });
    expect((await getAdminQuestion(question.id))!.isActive).toBe(true);
  });

  it("previews shuffles that keep pinned options last and respect the lock", async () => {
    await setup();
    const options = [option("Нэг"), option("Хоёр", true), option("Гурав"), option("Бүгд зөв", false, true)];

    const shuffled = await previewOptionOrders({ lockOptions: false, options });
    expect(shuffled).toHaveProperty("orders");
    for (const order of (shuffled as { orders: number[][] }).orders) {
      expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
      expect(order.at(-1)).toBe(3);
    }

    const locked = await previewOptionOrders({ lockOptions: true, options });
    for (const order of (locked as { orders: number[][] }).orders) {
      expect(order).toEqual([0, 1, 2, 3]);
    }
  });
});
