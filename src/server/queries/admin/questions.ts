import "server-only";
import { db } from "@/lib/db";
import {
  ADMIN_PAGE_SIZE,
  questionWhere,
  type QuestionFilters,
} from "./question-filters";

export type AdminQuestionRow = {
  id: string;
  code: string;
  text: string;
  subjectName: string;
  isActive: boolean;
  lockOptions: boolean;
  hasExplanation: boolean;
  optionCount: number;
  pinnedCount: number;
  answerCount: number;
};

export type AdminQuestionPage = {
  items: AdminQuestionRow[];
  total: number;
  page: number;
  pageCount: number;
};

/** One page of the admin table. Two queries (page + count), never one per row. */
export async function listAdminQuestions(filters: QuestionFilters): Promise<AdminQuestionPage> {
  const where = questionWhere(filters);
  const total = await db.question.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(filters.page, 1), pageCount);

  const rows = await db.question.findMany({
    where,
    orderBy: { code: "asc" },
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      code: true,
      text: true,
      isActive: true,
      lockOptions: true,
      explanation: true,
      subject: { select: { name: true } },
      _count: { select: { options: true, attemptItems: true } },
      options: { where: { pinned: true }, select: { id: true } },
    },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      text: row.text,
      subjectName: row.subject.name,
      isActive: row.isActive,
      lockOptions: row.lockOptions,
      hasExplanation: (row.explanation ?? "") !== "",
      optionCount: row._count.options,
      pinnedCount: row.options.length,
      answerCount: row._count.attemptItems,
    })),
    total,
    page,
    pageCount,
  };
}

export type AdminQuestionOption = {
  id: string;
  text: string;
  isCorrect: boolean;
  pinned: boolean;
  sortOrder: number;
};

export type AdminQuestion = {
  id: string;
  code: string;
  subjectId: string;
  text: string;
  imageUrl: string;
  explanation: string;
  lockOptions: boolean;
  isActive: boolean;
  options: AdminQuestionOption[];
  /** Attempt items referencing this question: once above 0, options may not be deleted. */
  attemptCount: number;
  /** Users whose progress a change of the correct answer would reset. */
  progressUserCount: number;
};

/** The question behind the edit form, or null when the id does not exist. */
export async function getAdminQuestion(questionId: string): Promise<AdminQuestion | null> {
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: {
      id: true,
      code: true,
      subjectId: true,
      text: true,
      imageUrl: true,
      explanation: true,
      lockOptions: true,
      isActive: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, isCorrect: true, pinned: true, sortOrder: true },
      },
      _count: { select: { attemptItems: true, progress: true } },
    },
  });
  if (!question) return null;

  return {
    id: question.id,
    code: question.code,
    subjectId: question.subjectId,
    text: question.text,
    imageUrl: question.imageUrl ?? "",
    explanation: question.explanation ?? "",
    lockOptions: question.lockOptions,
    isActive: question.isActive,
    options: question.options,
    attemptCount: question._count.attemptItems,
    progressUserCount: question._count.progress,
  };
}

/** Subjects for the admin pickers: every subject, including empty ones. */
export async function listAllSubjects() {
  return db.subject.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
}
