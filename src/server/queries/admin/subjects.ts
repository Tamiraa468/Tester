import "server-only";
import { db } from "@/lib/db";

export type AdminSubject = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  questionCount: number;
  activeQuestionCount: number;
};

/**
 * Every subject with the size of its bank. The active count is what an exam preset can
 * actually draw on; the total is what blocks a delete.
 */
export async function listAdminSubjects(): Promise<AdminSubject[]> {
  const subjects = await db.subject.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      sortOrder: true,
      _count: { select: { questions: true } },
    },
  });

  // One grouped query for the active counts, rather than one per subject.
  const active = await db.question.groupBy({
    by: ["subjectId"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const activeBySubject = new Map(active.map((row) => [row.subjectId, row._count._all]));

  return subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    slug: subject.slug,
    sortOrder: subject.sortOrder,
    questionCount: subject._count.questions,
    activeQuestionCount: activeBySubject.get(subject.id) ?? 0,
  }));
}
