import { afterEach, describe, expect, it } from "vitest";
import { AttemptMode, AttemptSource, AttemptStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { HEADERS, type Header } from "@/lib/import/types";
import { GET as exportRoute } from "@/app/api/admin/export/route";
import { GET as templateRoute } from "@/app/api/admin/template/route";
import { TestScope } from "@/test/db/fixtures";
import { signInAs } from "@/test/db/session";
import { previewImport, runImport } from "./import";
import { IMPORT_MESSAGES, MAX_DATA_ROWS, MAX_UPLOAD_BYTES } from "./import.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const NOW = new Date("2026-09-17T04:00:00.000Z");

/** Bypasses the test runner's console capture, so timings show up in the run. */
const report = (line: string) => process.stdout.write(`\n  [import] ${line}\n`);

type Row = Partial<Record<Header, string>>;

function csv(rows: Row[]): string {
  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return [
    HEADERS.join(","),
    ...rows.map((row) => HEADERS.map((header) => escape(row[header] ?? "")).join(",")),
  ].join("\n");
}

const csvFile = (rows: Row[], name = "bank.csv") => new File([csv(rows)], name);

function form(file: File, { confirm = false } = {}): FormData {
  const formData = new FormData();
  formData.set("file", file);
  if (confirm) formData.set("confirmAnswerChanges", "1");
  return formData;
}

/** The export route's own output, so the round trip runs through the real handler. */
async function exportedFile(): Promise<File> {
  const response = await exportRoute();
  expect(response.status).toBe(200);
  const buffer = Buffer.from(await response.arrayBuffer());
  return new File([new Uint8Array(buffer)], "export.xlsx");
}

/** Hands rows an import created to the scope, so cleanup removes them. */
async function trackImported(codes: string[]): Promise<void> {
  const questions = await db.question.findMany({
    where: { code: { in: codes } },
    select: { id: true, subjectId: true },
  });
  for (const question of questions) scope.trackQuestion(question.id);
  for (const subjectId of new Set(questions.map((question) => question.subjectId))) {
    scope.trackSubject(subjectId);
  }
}

async function optionsOf(code: string) {
  const question = await db.question.findUniqueOrThrow({
    where: { code },
    select: {
      isActive: true,
      lockOptions: true,
      explanation: true,
      imageUrl: true,
      options: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, text: true, isCorrect: true, pinned: true, sortOrder: true },
      },
    },
  });
  return question;
}

async function setupAdmin() {
  const admin = await scope.user("import-admin", { create: true });
  const member = await scope.user("import-member", { create: true });
  scope.freezeClock(NOW);
  signInAs(admin.clerkId, { admin: true });
  return { admin, member };
}

/** A bank with every shape the exporter has to represent. */
async function seedBank() {
  const subject = await scope.subject(0, "Экспорт");
  const specs = [
    { code: "RT-001", text: "Энгийн асуулт", pinned: "", lock: "", active: true, explanation: "Тайлбар" },
    { code: "RT-002", text: "Тогтмол хувилбартай", pinned: "c", lock: "", active: true, explanation: "" },
    { code: "RT-003", text: "Түгжээтэй асуулт", pinned: "", lock: "1", active: true, explanation: "Тайлбар 3" },
    { code: "RT-004", text: "Идэвхгүй асуулт", pinned: "", lock: "", active: false, explanation: "" },
  ];

  for (const spec of specs) {
    await db.question.create({
      data: {
        code: spec.code,
        subjectId: subject.id,
        text: spec.text,
        explanation: spec.explanation === "" ? null : spec.explanation,
        imageUrl: spec.code === "RT-001" ? "https://example.mn/a.png" : null,
        lockOptions: spec.lock === "1",
        isActive: spec.active,
        options: {
          create: [
            { text: `${spec.code} нэг`, isCorrect: false, pinned: false, sortOrder: 0 },
            { text: `${spec.code} хоёр`, isCorrect: true, pinned: false, sortOrder: 1 },
            {
              text: spec.pinned === "c" ? "Бүгд зөв" : `${spec.code} гурав`,
              isCorrect: false,
              pinned: spec.pinned === "c",
              sortOrder: 2,
            },
          ],
        },
      },
      select: { id: true },
    }).then((question) => scope.trackQuestion(question.id));
  }

  return { subject, codes: specs.map((spec) => spec.code) };
}

/** One graded answer plus a progress row, so a question counts as having history. */
async function recordAttempt(userId: string, code: string) {
  const question = await db.question.findUniqueOrThrow({
    where: { code },
    select: { id: true, options: { orderBy: { sortOrder: "asc" }, select: { id: true } } },
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
            questionId: question.id,
            position: 0,
            optionOrder: question.options.map((option) => option.id),
            selectedOptionId: question.options[1].id,
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
      questionId: question.id,
      box: 4,
      correctCount: 4,
      wrongCount: 1,
      lastAnsweredAt: NOW,
      nextReviewAt: new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  return question;
}

describe("export -> import round trip", () => {
  it("reports every row unchanged and moves no option id", async () => {
    await setupAdmin();
    const { codes } = await seedBank();
    const before = Object.fromEntries(
      await Promise.all(codes.map(async (code) => [code, await optionsOf(code)] as const)),
    );

    const preview = await previewImport(form(await exportedFile()));
    expect(preview).toMatchObject({
      totals: { errors: 0, toCreate: 0, toUpdate: codes.length },
      canImport: true,
      answerKeyChanges: [],
    });

    const summary = await runImport(form(await exportedFile()));
    expect(summary).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: codes.length,
      skipped: 0,
      answerKeyChanges: [],
    });

    for (const code of codes) {
      expect(await optionsOf(code), code).toEqual(before[code]);
    }
  });

  it("restores into an empty database and keeps inactive questions inactive", async () => {
    await setupAdmin();
    const { subject, codes } = await seedBank();
    const file = await exportedFile();

    // Wipe the bank, then restore it from the file alone.
    await db.question.deleteMany({ where: { code: { in: codes } } });
    await db.subject.delete({ where: { id: subject.id } });
    expect(await db.question.count({ where: { code: { in: codes } } })).toBe(0);

    const summary = await runImport(form(file));
    await trackImported(codes);
    expect(summary).toMatchObject({ created: codes.length, updated: 0, unchanged: 0 });

    const restored = await optionsOf("RT-004");
    expect(restored.isActive).toBe(false);
    expect((await optionsOf("RT-001")).isActive).toBe(true);
    expect((await optionsOf("RT-003")).lockOptions).toBe(true);
    expect((await optionsOf("RT-002")).options[2]).toMatchObject({ text: "Бүгд зөв", pinned: true });
    expect((await optionsOf("RT-001")).imageUrl).toBe("https://example.mn/a.png");
    // The subject came back by name.
    expect(await db.subject.count({ where: { name: subject.name } })).toBe(1);

    // And importing the same file once more changes nothing.
    expect(await runImport(form(await exportedFile()))).toMatchObject({
      unchanged: codes.length,
      created: 0,
      updated: 0,
    });
  });

  it("imports a file that has no active column without touching anything", async () => {
    await setupAdmin();
    const { subject } = await seedBank();
    await db.question.update({ where: { code: "RT-001" }, data: { isActive: false } });

    // A file written before the column existed: the required headers only.
    const legacy = [
      "code,subject,question,option_1,option_2,option_3,option_4,option_5,option_6,correct,pinned,lock,explanation,image_url",
      `RT-001,${subject.name},Энгийн асуулт,RT-001 нэг,RT-001 хоёр,RT-001 гурав,,,,b,,,Тайлбар,https://example.mn/a.png`,
    ].join("\n");

    const summary = await runImport(form(new File([legacy], "legacy.csv")));
    expect(summary).toMatchObject({ unchanged: 1, created: 0, updated: 0 });
    // Still inactive: a file without the column can never re-activate a question.
    expect((await optionsOf("RT-001")).isActive).toBe(false);
  });
});

describe("option identity through an import", () => {
  it("keeps each option id with its text when the columns are reordered", async () => {
    const { member } = await setupAdmin();
    const { subject } = await seedBank();
    await recordAttempt(member.id!, "RT-001");
    const before = await optionsOf("RT-001");
    const byText = new Map(before.options.map((option) => [option.text, option.id]));

    // The same three options, listed in reverse; the answer stays on "RT-001 хоёр".
    const summary = await runImport(
      form(
        csvFile([
          {
            code: "RT-001",
            subject: subject.name,
            question: "Энгийн асуулт",
            option_1: "RT-001 гурав",
            option_2: "RT-001 хоёр",
            option_3: "RT-001 нэг",
            correct: "b",
            explanation: "Тайлбар",
            image_url: "https://example.mn/a.png",
          },
        ]),
      ),
    );
    expect(summary).toMatchObject({ updated: 1, created: 0 });

    const after = await optionsOf("RT-001");
    expect(after.options.map((option) => [option.text, option.sortOrder])).toEqual([
      ["RT-001 гурав", 0],
      ["RT-001 хоёр", 1],
      ["RT-001 нэг", 2],
    ]);
    // Every id followed its text rather than its position.
    for (const option of after.options) {
      expect(option.id, option.text).toBe(byText.get(option.text));
    }
    expect(after.options.find((option) => option.isCorrect)!.text).toBe("RT-001 хоёр");
  });
});

describe("an answer key that moves", () => {
  async function changeKeyTo(subjectName: string, correct: string) {
    return csvFile([
      {
        code: "RT-001",
        subject: subjectName,
        question: "Энгийн асуулт",
        option_1: "RT-001 нэг",
        option_2: "RT-001 хоёр",
        option_3: "RT-001 гурав",
        correct,
        explanation: "Тайлбар",
        image_url: "https://example.mn/a.png",
      },
    ]);
  }

  it("is listed in the preview, refused without confirmation and resets progress with it", async () => {
    const { member } = await setupAdmin();
    const { subject } = await seedBank();
    const question = await recordAttempt(member.id!, "RT-001");

    const preview = await previewImport(form(await changeKeyTo(subject.name, "c")));
    expect(preview).toMatchObject({
      answerKeyChanges: [{ code: "RT-001", affectedUsers: 1 }],
      canImport: true,
    });
    expect(
      (preview as { issues: { message: string }[] }).issues.some((issue) =>
        issue.message.includes("Зөв хариулт өөрчлөгдөж байна"),
      ),
    ).toBe(true);

    // Without the confirmation nothing is written.
    expect(await runImport(form(await changeKeyTo(subject.name, "c")))).toMatchObject({
      needsConfirmation: { changes: [{ code: "RT-001", affectedUsers: 1 }] },
    });
    expect((await optionsOf("RT-001")).options[1].isCorrect).toBe(true);
    expect(await db.questionProgress.findFirstOrThrow({ where: { questionId: question.id } })).toMatchObject({
      box: 4,
    });

    // Confirmed: the key moves and everyone's schedule for it restarts.
    const summary = await runImport(form(await changeKeyTo(subject.name, "c"), { confirm: true }));
    expect(summary).toMatchObject({ updated: 1, answerKeyChanges: ["RT-001"] });

    const after = await optionsOf("RT-001");
    expect(after.options.map((option) => option.isCorrect)).toEqual([false, false, true]);

    const progress = await db.questionProgress.findFirstOrThrow({
      where: { questionId: question.id },
    });
    expect(progress.box).toBe(0);
    expect(progress.nextReviewAt).toEqual(NOW);
    // History is untouched.
    expect(progress.correctCount).toBe(4);
    const item = await db.attemptItem.findFirstOrThrow({ where: { questionId: question.id } });
    expect(item.isCorrect).toBe(true);
  });

  it("says nothing when the question has no attempts", async () => {
    await setupAdmin();
    const { subject } = await seedBank();

    const preview = await previewImport(form(await changeKeyTo(subject.name, "c")));
    expect(preview).toMatchObject({ answerKeyChanges: [] });
    expect(await runImport(form(await changeKeyTo(subject.name, "c")))).toMatchObject({ updated: 1 });
  });
});

describe("a file that cannot be imported", () => {
  it("reports row errors and writes nothing", async () => {
    await setupAdmin();
    const { subject } = await seedBank();
    const broken = csvFile([
      {
        code: "RT-900",
        subject: subject.name,
        question: "Шинэ асуулт",
        option_1: "Нэг",
        option_2: "Хоёр",
        // "ж" is neither a digit nor a Latin a-f, so the answer stays unresolved.
        correct: "ж",
      },
      {
        code: "RT-901",
        subject: subject.name,
        question: "Хувилбар дутуу",
        option_1: "Ганц",
        correct: "a",
      },
    ]);

    const preview = await previewImport(form(broken));
    expect(preview).toMatchObject({ canImport: false, totals: { errors: 2, valid: 0 } });
    expect((preview as { issues: { message: string }[] }).issues[0].message).toContain("correct");

    expect(await runImport(form(broken))).toEqual({ error: IMPORT_MESSAGES.hasErrors });
    expect(await db.question.count({ where: { code: { startsWith: "RT-9" } } })).toBe(0);
  });

  it("refuses a file that is too large or has too many rows", async () => {
    await setupAdmin();
    const { subject } = await seedBank();

    const huge = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1)], "huge.xlsx");
    expect(await previewImport(form(huge))).toEqual({ error: IMPORT_MESSAGES.tooLarge });
    expect(await runImport(form(huge))).toEqual({ error: IMPORT_MESSAGES.tooLarge });

    const tooMany = csvFile(
      Array.from({ length: MAX_DATA_ROWS + 1 }, (_, index) => ({
        code: `BULK-${index}`,
        subject: subject.name,
        question: `Асуулт ${index}`,
        option_1: "Нэг",
        option_2: "Хоёр",
        correct: "a",
      })),
    );
    expect(await previewImport(form(tooMany))).toEqual({
      error: IMPORT_MESSAGES.tooManyRows(MAX_DATA_ROWS + 1),
    });
    expect(await runImport(form(tooMany))).toEqual({
      error: IMPORT_MESSAGES.tooManyRows(MAX_DATA_ROWS + 1),
    });

    expect(await db.question.count({ where: { code: { startsWith: "BULK-" } } })).toBe(0);
    expect(await previewImport(form(new File(["x"], "notes.txt")))).toEqual({
      error: IMPORT_MESSAGES.badExtension,
    });
  });
});

describe("admin only", () => {
  it("refuses both actions and both route handlers", async () => {
    const { member } = await setupAdmin();
    const { subject } = await seedBank();
    const file = csvFile([
      {
        code: "RT-800",
        subject: subject.name,
        question: "Асуулт",
        option_1: "Нэг",
        option_2: "Хоёр",
        correct: "a",
      },
    ]);

    signInAs(null);
    await expect(previewImport(form(file))).rejects.toThrow("UNAUTHENTICATED");
    await expect(runImport(form(file))).rejects.toThrow("UNAUTHENTICATED");
    await expect(exportRoute()).rejects.toThrow("UNAUTHENTICATED");
    await expect(templateRoute()).rejects.toThrow("UNAUTHENTICATED");

    signInAs(member.clerkId);
    await expect(previewImport(form(file))).rejects.toThrow("NEXT_REDIRECT");
    await expect(runImport(form(file))).rejects.toThrow("NEXT_REDIRECT");
    await expect(exportRoute()).rejects.toThrow("NEXT_REDIRECT");
    await expect(templateRoute()).rejects.toThrow("NEXT_REDIRECT");

    expect(await db.question.count({ where: { code: "RT-800" } })).toBe(0);
  });

  it("serves the template to an admin", async () => {
    await setupAdmin();
    const response = await templateRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(".xlsx");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});

describe("a large import", () => {
  it("writes 1,000 questions in chunked transactions", async () => {
    await setupAdmin();
    const subject = await scope.subject(0, "Ачаалал");
    const rows: Row[] = Array.from({ length: 1000 }, (_, index) => ({
      code: `LOAD-${String(index).padStart(4, "0")}`,
      subject: subject.name,
      question: `Ачааллын асуулт ${index}: хамгийн зөв хариултыг сонгоно уу.`,
      option_1: `Хувилбар нэг ${index}`,
      option_2: `Хувилбар хоёр ${index}`,
      option_3: `Хувилбар гурав ${index}`,
      option_4: `Хувилбар дөрөв ${index}`,
      correct: "b",
      explanation: `Тайлбар ${index}`,
    }));
    const codes = rows.map((row) => row.code!);

    const startedAt = Date.now();
    const summary = await runImport(form(csvFile(rows, "load.csv")));
    const elapsedMs = Date.now() - startedAt;
    await trackImported(codes);

    expect(summary).toMatchObject({ created: 1000, updated: 0, unchanged: 0, skipped: 0 });
    // Written straight to stdout so the number is visible in the run, not captured.
    report(`1,000 questions created in ${elapsedMs} ms (commit ${(summary as { elapsedMs: number }).elapsedMs} ms)`);
    // A budget, so a regression to per-row queries or to one huge transaction fails here.
    expect(elapsedMs).toBeLessThan(60_000);
    expect(await db.question.count({ where: { code: { startsWith: "LOAD-" } } })).toBe(1000);

    // Running the same file again is a no-op, which is what makes chunking safe.
    const again = Date.now();
    expect(await runImport(form(csvFile(rows, "load.csv")))).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1000,
    });
    report(`1,000 questions re-imported unchanged in ${Date.now() - again} ms`);
  }, 120_000);
});
