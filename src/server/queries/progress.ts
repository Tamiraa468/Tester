import "server-only";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import {
  buildActivityDays,
  currentStreak,
  type ActivityRow,
} from "@/lib/activity";
import { now } from "@/lib/clock";
import { addDays, ubDayKey, ubDayStart, UB_TIME_ZONE, type DayKey } from "@/lib/date";
import { db } from "@/lib/db";
import { MASTERED_BOX } from "@/lib/quiz/leitner";
import { progressOrderForSource, questionWhereForSource } from "./question-sources";
import { countsBySource } from "./questions";

/**
 * Everything the dashboard and the review hub read, per user. Each figure is one
 * query — a groupBy, an aggregate or a single raw statement — never one query per
 * question or per subject. Raw SQL is always a $queryRaw tagged template (parameters
 * only, never $queryRawUnsafe) and casts every count and sum in SQL: count(*) is
 * bigint in Postgres, and a BigInt cannot be passed to a Client Component.
 */

/** How far back the streak may reach. The chart still shows only the last 30 days. */
const STREAK_WINDOW_DAYS = 365;

type Totals = {
  /** Active questions in the bank. */
  total: number;
  /** Questions with a QuestionProgress row. */
  seen: number;
  /** Questions in box MASTERED_BOX or higher. */
  mastered: number;
  /** Graded answers counted in QuestionProgress. */
  answered: number;
  correct: number;
  /** correct / answered, or null when nothing has been answered yet. */
  accuracy: number | null;
};

export type BankStats = Totals;
export type SubjectStats = Totals & { subjectId: string; subjectName: string };

type CountedRow = Omit<Totals, "accuracy">;

function withAccuracy<T extends CountedRow>(row: T): T & { accuracy: number | null } {
  return { ...row, accuracy: row.answered === 0 ? null : row.correct / row.answered };
}

/**
 * Bank-wide progress. One LEFT JOIN over active questions: questions the user has
 * never touched still count towards `total`, and `seen` counts the rows that matched.
 */
export async function getBankStats(userId: string): Promise<BankStats> {
  const [row] = await db.$queryRaw<CountedRow[]>`
    SELECT
      count(*)::int AS "total",
      count(p."questionId")::int AS "seen",
      (count(*) FILTER (WHERE p."box" >= ${MASTERED_BOX}))::int AS "mastered",
      coalesce(sum(p."correctCount" + p."wrongCount"), 0)::int AS "answered",
      coalesce(sum(p."correctCount"), 0)::int AS "correct"
    FROM "Question" q
    LEFT JOIN "QuestionProgress" p
      ON p."questionId" = q."id" AND p."userId" = ${userId}
    WHERE q."isActive" = true`;
  return withAccuracy(row);
}

/**
 * The same figures per subject, weakest first: fewest mastered in relation to the
 * subject's size, then lowest accuracy (a subject with nothing answered sorts last,
 * since it is not yet evidence of weakness). Only subjects with active questions
 * appear — the join starts from those questions.
 */
export async function getSubjectStats(userId: string): Promise<SubjectStats[]> {
  const rows = await db.$queryRaw<(CountedRow & { subjectId: string; subjectName: string })[]>`
    SELECT
      s."id" AS "subjectId",
      s."name" AS "subjectName",
      count(*)::int AS "total",
      count(p."questionId")::int AS "seen",
      (count(*) FILTER (WHERE p."box" >= ${MASTERED_BOX}))::int AS "mastered",
      coalesce(sum(p."correctCount" + p."wrongCount"), 0)::int AS "answered",
      coalesce(sum(p."correctCount"), 0)::int AS "correct"
    FROM "Question" q
    JOIN "Subject" s ON s."id" = q."subjectId"
    LEFT JOIN "QuestionProgress" p
      ON p."questionId" = q."id" AND p."userId" = ${userId}
    WHERE q."isActive" = true
    GROUP BY s."id", s."name", s."sortOrder"
    ORDER BY
      (count(*) FILTER (WHERE p."box" >= ${MASTERED_BOX}))::float / count(*) ASC,
      CASE
        WHEN coalesce(sum(p."correctCount" + p."wrongCount"), 0) > 0
        THEN sum(p."correctCount")::float / sum(p."correctCount" + p."wrongCount")
      END ASC NULLS LAST,
      s."sortOrder" ASC,
      s."name" ASC`;
  return rows.map(withAccuracy);
}

/** The review hub's tabs, in the order they are shown. */
export const REVIEW_TABS = [
  AttemptSource.DUE,
  AttemptSource.WRONG,
  AttemptSource.BOOKMARKED,
] as const;

export type ReviewTab = (typeof REVIEW_TABS)[number];
export type ReviewCounts = Record<ReviewTab, number>;

/**
 * How many questions each review tab holds. Straight from countsBySource, so these
 * numbers are exactly what a practice started from the tab would draw on.
 */
export async function getReviewCounts(userId: string): Promise<ReviewCounts> {
  const counts = await countsBySource(userId);
  return {
    [AttemptSource.DUE]: counts.DUE,
    [AttemptSource.WRONG]: counts.WRONG,
    [AttemptSource.BOOKMARKED]: counts.BOOKMARKED,
  };
}

export type Activity = {
  /** The last 30 days, oldest first, zero-filled. */
  days: ActivityRow[];
  streak: number;
  /** The day, in Asia/Ulaanbaatar, the window ends on. */
  today: DayKey;
};

/**
 * Graded answers per day, practice and exam together. An item counts on the day it
 * was answered in Asia/Ulaanbaatar — 07:00 there is 23:00 UTC the day before, and
 * belongs to the Mongolian day. An exam still in progress has answeredAt but no grade
 * yet, so it is counted only once the exam has been finalized.
 */
export async function getActivity(userId: string): Promise<Activity> {
  const today = ubDayKey(now());
  const from = ubDayStart(addDays(today, -(STREAK_WINDOW_DAYS - 1)));

  // Prisma stores DateTime as UTC in timestamp(3) columns, so the stored value is read
  // back as UTC and only then converted to the Mongolian day.
  const rows = await db.$queryRaw<ActivityRow[]>`
    SELECT
      to_char(
        (i."answeredAt" AT TIME ZONE 'UTC' AT TIME ZONE ${UB_TIME_ZONE})::date,
        'YYYY-MM-DD'
      ) AS "day",
      count(*)::int AS "total",
      (count(*) FILTER (WHERE i."isCorrect"))::int AS "correct"
    FROM "AttemptItem" i
    JOIN "Attempt" a ON a."id" = i."attemptId"
    WHERE a."userId" = ${userId}
      AND i."answeredAt" IS NOT NULL
      AND i."isCorrect" IS NOT NULL
      AND i."answeredAt" >= ${from.toISOString()}::timestamp(3)
    GROUP BY 1
    ORDER BY 1`;

  return { days: buildActivityDays(rows, today), streak: currentStreak(rows, today), today };
}

export type RecentAttempt = {
  id: string;
  mode: AttemptMode;
  source: AttemptSource | null;
  status: AttemptStatus;
  presetName: string | null;
  subjectName: string | null;
  startedAt: Date;
  totalCount: number;
  correctCount: number;
};

/** The user's last finished attempts, both modes, newest first. */
export async function listRecentAttempts(userId: string, take = 10): Promise<RecentAttempt[]> {
  const attempts = await db.attempt.findMany({
    where: { userId, status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.EXPIRED] } },
    // The id breaks a tie, so two attempts started in the same millisecond always come
    // back in the same order instead of whatever the scan happens to return.
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      mode: true,
      source: true,
      status: true,
      startedAt: true,
      totalCount: true,
      correctCount: true,
      preset: { select: { name: true } },
      subject: { select: { name: true } },
    },
  });
  return attempts.map((attempt) => ({
    id: attempt.id,
    mode: attempt.mode,
    source: attempt.source,
    status: attempt.status,
    presetName: attempt.preset?.name ?? null,
    subjectName: attempt.subject?.name ?? null,
    startedAt: attempt.startedAt,
    totalCount: attempt.totalCount,
    correctCount: attempt.correctCount ?? 0,
  }));
}

export type DashboardData = {
  bank: BankStats;
  subjects: SubjectStats[];
  reviewCounts: ReviewCounts;
  activity: Activity;
  recentAttempts: RecentAttempt[];
};

/** Everything /dashboard shows. Call finalizeMyExpiredExam() first. */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const [bank, subjects, reviewCounts, activity, recentAttempts] = await Promise.all([
    getBankStats(userId),
    getSubjectStats(userId),
    getReviewCounts(userId),
    getActivity(userId),
    listRecentAttempts(userId),
  ]);
  return { bank, subjects, reviewCounts, activity, recentAttempts };
}

/** A user who has never answered anything sees the empty state. */
export function isNewUser(data: Pick<DashboardData, "bank" | "recentAttempts">): boolean {
  return data.bank.seen === 0 && data.recentAttempts.length === 0;
}

export const REVIEW_PAGE_SIZE = 20;

export type ReviewQuestion = {
  id: string;
  code: string;
  text: string;
  subjectName: string;
  /** Progress detail, when the tab is built on it. */
  box: number | null;
  wrongCount: number | null;
  nextReviewAt: Date | null;
  bookmarkedAt: Date | null;
};

export type ReviewPage = {
  tab: ReviewTab;
  items: ReviewQuestion[];
  total: number;
  page: number;
  pageCount: number;
};

const reviewQuestionSelect = {
  id: true,
  code: true,
  text: true,
  subject: { select: { name: true } },
} as const;

type SelectedQuestion = {
  id: string;
  code: string;
  text: string;
  subject: { name: string };
};

function toReviewQuestion(
  question: SelectedQuestion,
  extra: Partial<Pick<ReviewQuestion, "box" | "wrongCount" | "nextReviewAt" | "bookmarkedAt">>,
): ReviewQuestion {
  return {
    id: question.id,
    code: question.code,
    text: question.text,
    subjectName: question.subject.name,
    box: extra.box ?? null,
    wrongCount: extra.wrongCount ?? null,
    nextReviewAt: extra.nextReviewAt ?? null,
    bookmarkedAt: extra.bookmarkedAt ?? null,
  };
}

/**
 * One page of a review tab. The filter is questionWhereForSource — the very builder
 * countsBySource uses — so a tab's list and its count badge can never disagree, and
 * inactive questions are excluded from both. Only question text is selected: no
 * options, no correct answer, no explanation.
 */
export async function listReviewQuestions(
  userId: string,
  tab: ReviewTab,
  page = 1,
): Promise<ReviewPage> {
  const where = questionWhereForSource({ userId, now: now(), source: tab });
  const total = await db.question.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / REVIEW_PAGE_SIZE));
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount);
  const skip = (current - 1) * REVIEW_PAGE_SIZE;

  let items: ReviewQuestion[];
  if (tab === AttemptSource.BOOKMARKED) {
    // Newest bookmark first; served by Bookmark(userId, createdAt).
    const rows = await db.bookmark.findMany({
      where: { userId, question: where },
      orderBy: [{ createdAt: "desc" }, { questionId: "asc" }],
      skip,
      take: REVIEW_PAGE_SIZE,
      select: { createdAt: true, question: { select: reviewQuestionSelect } },
    });
    items = rows.map((row) => toReviewQuestion(row.question, { bookmarkedAt: row.createdAt }));
  } else {
    // Same order a practice from this tab would pick in: most urgent first.
    const rows = await db.questionProgress.findMany({
      where: { userId, question: where },
      orderBy: [...(progressOrderForSource(tab) ?? []), { questionId: "asc" }],
      skip,
      take: REVIEW_PAGE_SIZE,
      select: {
        box: true,
        wrongCount: true,
        nextReviewAt: true,
        question: { select: reviewQuestionSelect },
      },
    });
    items = rows.map((row) =>
      toReviewQuestion(row.question, {
        box: row.box,
        wrongCount: row.wrongCount,
        nextReviewAt: row.nextReviewAt,
      }),
    );
  }

  return { tab, items, total, page: current, pageCount };
}
