"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { uniqueSubjectSlug } from "@/lib/import/subject-slug";
import {
  createSubjectSchema,
  deleteSubjectSchema,
  SUBJECT_MESSAGES,
  updateSubjectSchema,
  type CreateSubjectInput,
  type DeleteSubjectInput,
  type UpdateSubjectInput,
} from "./subjects.schemas";

export type AdminActionError = { error: string };

function revalidateSubjects(): void {
  revalidatePath("/admin");
  revalidatePath("/admin/subjects");
  revalidatePath("/admin/questions");
  revalidatePath("/admin/exam-presets");
}

/** Subject.name is unique, and an import matches an existing subject by that name. */
function duplicateName(error: unknown, name: string): AdminActionError | null {
  return (error as { code?: string }).code === "P2002"
    ? { error: SUBJECT_MESSAGES.duplicateName(name) }
    : null;
}

export async function createSubject(
  input: CreateSubjectInput,
): Promise<{ subjectId: string } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = createSubjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, sortOrder } = parsed.data;

  const existing = await db.subject.findUnique({ where: { name }, select: { id: true } });
  if (existing) return { error: SUBJECT_MESSAGES.duplicateName(name) };

  try {
    // The slug is derived once, here; a later rename never touches it.
    const created = await db.subject.create({
      data: { name, sortOrder, slug: await uniqueSubjectSlug(db, name) },
      select: { id: true },
    });
    revalidateSubjects();
    return { subjectId: created.id };
  } catch (error) {
    const duplicate = duplicateName(error, name);
    if (duplicate) return duplicate;
    throw error;
  }
}

/**
 * Renames a subject and/or moves it in the order. The slug stays as it was: it is an
 * identifier, not a label, and re-deriving it on every rename would break anything
 * already pointing at it.
 */
export async function updateSubject(
  input: UpdateSubjectInput,
): Promise<{ ok: true } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = updateSubjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { subjectId, name, sortOrder } = parsed.data;

  const subject = await db.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
  if (!subject) return { error: SUBJECT_MESSAGES.notFound };

  const clash = await db.subject.findUnique({ where: { name }, select: { id: true } });
  if (clash && clash.id !== subjectId) return { error: SUBJECT_MESSAGES.duplicateName(name) };

  try {
    await db.subject.update({ where: { id: subjectId }, data: { name, sortOrder } });
    revalidateSubjects();
    return { ok: true };
  } catch (error) {
    const duplicate = duplicateName(error, name);
    if (duplicate) return duplicate;
    throw error;
  }
}

/** A subject that still holds questions cannot be deleted. */
export async function deleteSubject(
  input: DeleteSubjectInput,
): Promise<{ ok: true } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = deleteSubjectSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { subjectId } = parsed.data;

  const outcome = await db.$transaction(async (tx) => {
    const subject = await tx.subject.findUnique({ where: { id: subjectId }, select: { id: true } });
    if (!subject) return { error: SUBJECT_MESSAGES.notFound };

    // Counted inside the transaction, so an import cannot add a question in between.
    const questions = await tx.question.count({ where: { subjectId } });
    if (questions > 0) return { error: SUBJECT_MESSAGES.hasQuestions(questions) };

    await tx.subject.delete({ where: { id: subjectId } });
    return { ok: true } as const;
  });

  if ("error" in outcome) return outcome;
  revalidateSubjects();
  return { ok: true };
}
