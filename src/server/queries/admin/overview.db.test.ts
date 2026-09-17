import { afterEach, describe, expect, it } from "vitest";
import { AttemptMode, AttemptSource, AttemptStatus, ReportStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { correctOptionId, TestScope } from "@/test/db/fixtures";
import { getAdminCounts, listQuestionsNeedingReview, REVIEW_MIN_USERS } from "./overview";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const NOW = new Date("2026-09-17T04:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

async function optionsOf(questionId: string) {
  return db.option.findMany({
    where: { questionId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, text: true, isCorrect: true },
  });
}

/** One finished single-question practice, so the answer is graded. */
async function recordAnswer(
  userId: string,
  questionId: string,
  optionId: string,
  isCorrect: boolean,
  answeredAt: Date,
) {
  const options = await optionsOf(questionId);
  await db.attempt.create({
    data: {
      userId,
      mode: AttemptMode.PRACTICE,
      source: AttemptSource.RANDOM,
      status: AttemptStatus.SUBMITTED,
      totalCount: 1,
      correctCount: isCorrect ? 1 : 0,
      startedAt: answeredAt,
      submittedAt: answeredAt,
      items: {
        create: [
          {
            questionId,
            position: 0,
            optionOrder: options.map((option) => option.id),
            selectedOptionId: optionId,
            isCorrect,
            answeredAt,
          },
        ],
      },
    },
  });
}

async function makeUsers(count: number, label: string): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const user = await scope.user(`${label}-${index}`, { create: true });
    ids.push(user.id!);
  }
  return ids;
}

describe("getAdminCounts", () => {
  it("counts the active bank, subjects, users, recent attempts and open reports", async () => {
    const bank = await scope.subject([{}, {}, { isActive: false }], "Тоо");
    const [alice, bob] = await makeUsers(2, "counts");
    const correct = await correctOptionId(bank.questionIds[0]);

    // Inside the 7-day window, and one attempt well outside it.
    await recordAnswer(alice, bank.questionIds[0], correct, true, new Date(NOW.getTime() - DAY_MS));
    await recordAnswer(bob, bank.questionIds[0], correct, true, new Date(NOW.getTime() - 30 * DAY_MS));

    await db.questionReport.createMany({
      data: [
        { questionId: bank.questionIds[0], userId: alice, message: "Хариулт буруу байна." },
        {
          questionId: bank.questionIds[1],
          userId: bob,
          message: "Шийдсэн асуудал.",
          status: ReportStatus.RESOLVED,
        },
      ],
    });

    scope.freezeClock(NOW);
    const counts = await getAdminCounts();
    expect(counts.activeQuestions).toBe(2);
    expect(counts.subjects).toBe(1);
    expect(counts.users).toBe(2);
    expect(counts.attemptsLast7Days).toBe(1);
    expect(counts.openReports).toBe(1);
  });
});

describe("listQuestionsNeedingReview", () => {
  it("ranks by the share of users who got it wrong the first time", async () => {
    const bank = await scope.subject(2, "Хянах");
    const [hard, easy] = bank.questionIds;
    const hardOptions = await optionsOf(hard);
    const easyOptions = await optionsOf(easy);
    const hardCorrect = hardOptions.find((option) => option.isCorrect)!;
    const easyCorrect = easyOptions.find((option) => option.isCorrect)!;
    // The wrong option most users fall for, and one they pick less often.
    const decoy = hardOptions.find((option) => !option.isCorrect)!;
    const other = hardOptions.filter((option) => !option.isCorrect)[1];

    const users = await makeUsers(12, "review");
    for (const [index, userId] of users.entries()) {
      // 9 of 12 wrong: 7 on the decoy, 2 on another option.
      const wrong = index < 9;
      const option = wrong ? (index < 7 ? decoy : other) : hardCorrect;
      await recordAnswer(userId, hard, option.id, !wrong, new Date(NOW.getTime() + index));
      // The same users mostly get the easy question right: 2 of 12 wrong.
      const easyWrong = index < 2;
      await recordAnswer(
        userId,
        easy,
        easyWrong ? easyOptions[0].id : easyCorrect.id,
        !easyWrong,
        new Date(NOW.getTime() + index),
      );
    }

    const rows = await listQuestionsNeedingReview();
    expect(rows.map((row) => row.id)).toEqual([hard, easy]);

    const [worst] = rows;
    expect(worst).toMatchObject({
      users: 12,
      wrong: 9,
      topWrongText: decoy.text,
      topWrongPicks: 7,
      correctText: hardCorrect.text,
      subjectName: bank.name,
    });
    expect(worst.wrongRate).toBeCloseTo(0.75, 10);
    expect(rows[1].wrongRate).toBeCloseTo(2 / 12, 10);
  });

  it("counts each user once, by their FIRST answer", async () => {
    const bank = await scope.subject(1, "Эхний");
    const [questionId] = bank.questionIds;
    const options = await optionsOf(questionId);
    const correct = options.find((option) => option.isCorrect)!;
    const wrong = options.find((option) => !option.isCorrect)!;

    const users = await makeUsers(REVIEW_MIN_USERS, "first");
    for (const [index, userId] of users.entries()) {
      // Everyone starts by getting it wrong, then practises it right twice.
      await recordAnswer(userId, questionId, wrong.id, false, new Date(NOW.getTime() + index));
      await recordAnswer(userId, questionId, correct.id, true, new Date(NOW.getTime() + DAY_MS));
      await recordAnswer(userId, questionId, correct.id, true, new Date(NOW.getTime() + 2 * DAY_MS));
    }

    const [row] = await listQuestionsNeedingReview();
    // 30 answers in total, but 10 users and 10 first answers, all of them wrong.
    expect(row).toMatchObject({ users: REVIEW_MIN_USERS, wrong: REVIEW_MIN_USERS });
    expect(row.wrongRate).toBe(1);
  });

  it("ignores a question one struggling user answered many times", async () => {
    const bank = await scope.subject(1, "Ганц");
    const [questionId] = bank.questionIds;
    const options = await optionsOf(questionId);
    const wrong = options.find((option) => !option.isCorrect)!;
    const [userId] = await makeUsers(1, "lonely");

    for (let attempt = 0; attempt < REVIEW_MIN_USERS * 2; attempt += 1) {
      await recordAnswer(userId, questionId, wrong.id, false, new Date(NOW.getTime() + attempt));
    }

    expect(await listQuestionsNeedingReview()).toEqual([]);
  });

  it("leaves out a question too few users have seen, and unanswered ones", async () => {
    const bank = await scope.subject(2, "Цөөн");
    const options = await optionsOf(bank.questionIds[0]);
    const wrong = options.find((option) => !option.isCorrect)!;

    const users = await makeUsers(REVIEW_MIN_USERS - 1, "few");
    for (const [index, userId] of users.entries()) {
      await recordAnswer(userId, bank.questionIds[0], wrong.id, false, new Date(NOW.getTime() + index));
    }
    expect(await listQuestionsNeedingReview()).toEqual([]);

    // One more user tips it over the threshold.
    const [extra] = await makeUsers(1, "extra");
    await recordAnswer(extra, bank.questionIds[0], wrong.id, false, NOW);
    const rows = await listQuestionsNeedingReview();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: bank.questionIds[0], users: REVIEW_MIN_USERS });
  });

  it("does not count an exam still in progress, whose answers are not graded yet", async () => {
    const bank = await scope.subject(1, "Шалгалт");
    const [questionId] = bank.questionIds;
    const options = await optionsOf(questionId);
    const users = await makeUsers(REVIEW_MIN_USERS, "ungraded");

    for (const userId of users) {
      await db.attempt.create({
        data: {
          userId,
          mode: AttemptMode.EXAM,
          status: AttemptStatus.IN_PROGRESS,
          totalCount: 1,
          startedAt: NOW,
          items: {
            create: [
              {
                questionId,
                position: 0,
                optionOrder: options.map((option) => option.id),
                selectedOptionId: options[0].id,
                isCorrect: null,
                answeredAt: NOW,
              },
            ],
          },
        },
      });
    }

    expect(await listQuestionsNeedingReview()).toEqual([]);
  });
});
