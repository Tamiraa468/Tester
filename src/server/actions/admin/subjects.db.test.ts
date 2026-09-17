import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { listAdminSubjects } from "@/server/queries/admin/subjects";
import { TestScope } from "@/test/db/fixtures";
import { signInAs } from "@/test/db/session";
import { createSubject, deleteSubject, updateSubject } from "./subjects";
import { SUBJECT_MESSAGES } from "./subjects.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

async function setup() {
  const admin = await scope.user("subject-admin", { create: true });
  const member = await scope.user("subject-member", { create: true });
  signInAs(admin.clerkId, { admin: true });
  return { admin, member };
}

/** createSubject() is the code under test, so the scope is told to clean up after it. */
async function create(name: string, sortOrder = 0): Promise<string> {
  const result = await createSubject({ name, sortOrder });
  expect(result, name).toHaveProperty("subjectId");
  const { subjectId } = result as { subjectId: string };
  scope.trackSubject(subjectId);
  return subjectId;
}

const subjectById = (id: string) => db.subject.findUniqueOrThrow({ where: { id } });

describe("admin subjects", () => {
  it("refuses everyone who is not an admin", async () => {
    const { member } = await setup();
    const id = await create("Эрх зүй");

    signInAs(null);
    await expect(createSubject({ name: "Шинэ", sortOrder: 0 })).rejects.toThrow("UNAUTHENTICATED");
    await expect(updateSubject({ subjectId: id, name: "Өөр", sortOrder: 0 })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(deleteSubject({ subjectId: id })).rejects.toThrow("UNAUTHENTICATED");

    signInAs(member.clerkId);
    await expect(createSubject({ name: "Шинэ", sortOrder: 0 })).rejects.toThrow("NEXT_REDIRECT");
    await expect(updateSubject({ subjectId: id, name: "Өөр", sortOrder: 0 })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    await expect(deleteSubject({ subjectId: id })).rejects.toThrow("NEXT_REDIRECT");

    expect((await subjectById(id)).name).toBe("Эрх зүй");
  });

  it("derives the slug from the name and suffixes a collision", async () => {
    await setup();
    // "Ө" and "О" both transliterate to "o", so these two names produce one base slug.
    const first = await create("Өмгөөлөл");
    const second = await create("Омгоолол");

    expect((await subjectById(first)).slug).toBe("omgoolol");
    expect((await subjectById(second)).slug).toBe("omgoolol-2");
  });

  it("keeps the slug when the subject is renamed", async () => {
    await setup();
    const id = await create("Статистик", 3);
    const slug = (await subjectById(id)).slug;
    expect(slug).toBe("statistik");

    expect(await updateSubject({ subjectId: id, name: "Хэрэглээний статистик", sortOrder: 1 })).toEqual({
      ok: true,
    });

    const after = await subjectById(id);
    expect(after.name).toBe("Хэрэглээний статистик");
    expect(after.sortOrder).toBe(1);
    // The slug is an identifier, not a label: a rename must not move it.
    expect(after.slug).toBe(slug);
  });

  it("refuses a duplicate name, on create and on rename", async () => {
    await setup();
    await create("Философи");
    const other = await create("Социологи");

    expect(await createSubject({ name: "Философи", sortOrder: 0 })).toEqual({
      error: SUBJECT_MESSAGES.duplicateName("Философи"),
    });
    expect(await updateSubject({ subjectId: other, name: "Философи", sortOrder: 0 })).toEqual({
      error: SUBJECT_MESSAGES.duplicateName("Философи"),
    });
    // Renaming a subject to the name it already has is fine.
    expect(await updateSubject({ subjectId: other, name: "Социологи", sortOrder: 2 })).toEqual({
      ok: true,
    });

    expect(await db.subject.count({ where: { name: "Философи" } })).toBe(1);
  });

  it("trims and requires a name", async () => {
    await setup();
    expect(await createSubject({ name: "   ", sortOrder: 0 })).toEqual({
      error: SUBJECT_MESSAGES.nameRequired,
    });
    const id = await create("  Зай  ");
    expect((await subjectById(id)).name).toBe("Зай");
  });

  it("deletes an empty subject but never one that still holds questions", async () => {
    await setup();
    const empty = await create("Хоосон");
    const withQuestions = await scope.subject(2, "Дүүрэн");

    expect(await deleteSubject({ subjectId: withQuestions.id })).toEqual({
      error: SUBJECT_MESSAGES.hasQuestions(2),
    });
    expect(await db.subject.count({ where: { id: withQuestions.id } })).toBe(1);

    // Inactive questions still count: they are rows pointing at the subject.
    await db.question.updateMany({ where: { subjectId: withQuestions.id }, data: { isActive: false } });
    expect(await deleteSubject({ subjectId: withQuestions.id })).toEqual({
      error: SUBJECT_MESSAGES.hasQuestions(2),
    });

    expect(await deleteSubject({ subjectId: empty })).toEqual({ ok: true });
    expect(await db.subject.count({ where: { id: empty } })).toBe(0);
    expect(await deleteSubject({ subjectId: empty })).toEqual({ error: SUBJECT_MESSAGES.notFound });
  });

  it("lists subjects in order with their total and active question counts", async () => {
    await setup();
    const bank = await scope.subject([{}, {}, { isActive: false }], "Жагсаалт");
    const empty = await create("Хоосон жагсаалт", 99);

    const subjects = await listAdminSubjects();
    const listed = subjects.find((subject) => subject.id === bank.id)!;
    expect(listed).toMatchObject({ questionCount: 3, activeQuestionCount: 2 });
    expect(subjects.find((subject) => subject.id === empty)).toMatchObject({
      questionCount: 0,
      activeQuestionCount: 0,
    });
    // sortOrder decides the order; 99 sorts last.
    expect(subjects.at(-1)!.id).toBe(empty);
  });
});
