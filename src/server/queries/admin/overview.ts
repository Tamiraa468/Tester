import "server-only";
import { ReportStatus } from "@/generated/prisma/enums";
import { now } from "@/lib/clock";
import { db } from "@/lib/db";

/**
 * The /admin overview. Raw SQL is always a $queryRaw tagged template (parameters only)
 * with quoted identifiers, and casts every count in SQL: count(*) is bigint in
 * Postgres, and a BigInt cannot be passed to a Client Component.
 */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A question is only flagged once this many DIFFERENT users have answered it. Counting
 * answers instead would let one struggling user who practises the same question ten
 * times look like a broken answer key.
 */
export const REVIEW_MIN_USERS = 10;

/** How many rows the review table shows at most. */
const REVIEW_LIMIT = 50;

export type AdminCounts = {
  activeQuestions: number;
  subjects: number;
  users: number;
  attemptsLast7Days: number;
  openReports: number;
};

export async function getAdminCounts(): Promise<AdminCounts> {
  const since = new Date(now().getTime() - WEEK_MS);
  const [activeQuestions, subjects, users, attemptsLast7Days, openReports] = await Promise.all([
    db.question.count({ where: { isActive: true } }),
    db.subject.count(),
    db.user.count(),
    db.attempt.count({ where: { startedAt: { gte: since } } }),
    db.questionReport.count({ where: { status: ReportStatus.OPEN } }),
  ]);
  return { activeQuestions, subjects, users, attemptsLast7Days, openReports };
}

export type QuestionNeedingReview = {
  id: string;
  code: string;
  text: string;
  subjectName: string;
  isActive: boolean;
  /** Distinct users whose FIRST graded answer to this question is counted. */
  users: number;
  wrong: number;
  wrongRate: number;
  /** The wrong option the most users picked first, if anyone got it wrong. */
  topWrongText: string | null;
  topWrongPicks: number | null;
  correctText: string | null;
};

/**
 * Questions where a high share of users got it wrong the FIRST time they met it —
 * often a wrong answer key rather than a hard question.
 *
 * Only each user's first graded answer counts: after the answer is revealed, every
 * later attempt at the same question is informed by it, so including repeats would
 * measure practice, not the question. Questions fewer than REVIEW_MIN_USERS users have
 * seen are left out entirely.
 */
export async function listQuestionsNeedingReview(): Promise<QuestionNeedingReview[]> {
  return db.$queryRaw<QuestionNeedingReview[]>`
    WITH "firstAnswers" AS (
      SELECT DISTINCT ON (a."userId", i."questionId")
        a."userId",
        i."questionId",
        i."selectedOptionId",
        i."isCorrect"
      FROM "AttemptItem" i
      JOIN "Attempt" a ON a."id" = i."attemptId"
      WHERE i."selectedOptionId" IS NOT NULL AND i."isCorrect" IS NOT NULL
      ORDER BY a."userId", i."questionId", i."answeredAt" ASC NULLS LAST, i."id" ASC
    ),
    "stats" AS (
      SELECT
        "questionId",
        count(*)::int AS "users",
        (count(*) FILTER (WHERE NOT "isCorrect"))::int AS "wrong"
      FROM "firstAnswers"
      GROUP BY "questionId"
      HAVING count(*) >= ${REVIEW_MIN_USERS}
    ),
    "topWrong" AS (
      SELECT DISTINCT ON (f."questionId")
        f."questionId",
        f."selectedOptionId" AS "optionId",
        count(*)::int AS "picks"
      FROM "firstAnswers" f
      WHERE NOT f."isCorrect"
      GROUP BY f."questionId", f."selectedOptionId"
      ORDER BY f."questionId", count(*) DESC, f."selectedOptionId" ASC
    )
    SELECT
      q."id",
      q."code",
      q."text",
      q."isActive",
      s."name" AS "subjectName",
      st."users",
      st."wrong",
      (st."wrong"::float / st."users") AS "wrongRate",
      wo."text" AS "topWrongText",
      tw."picks" AS "topWrongPicks",
      co."text" AS "correctText"
    FROM "stats" st
    JOIN "Question" q ON q."id" = st."questionId"
    JOIN "Subject" s ON s."id" = q."subjectId"
    LEFT JOIN "topWrong" tw ON tw."questionId" = st."questionId"
    LEFT JOIN "Option" wo ON wo."id" = tw."optionId"
    LEFT JOIN "Option" co ON co."questionId" = q."id" AND co."isCorrect" = true
    ORDER BY (st."wrong"::float / st."users") DESC, st."users" DESC, q."code" ASC
    LIMIT ${REVIEW_LIMIT}`;
}
