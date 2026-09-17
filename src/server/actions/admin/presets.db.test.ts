import { afterEach, describe, expect, it } from "vitest";
import { AttemptMode, AttemptStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { PRESET_MESSAGES } from "@/lib/quiz/exam-preset";
import { listAdminPresets } from "@/server/queries/admin/presets";
import { TestScope } from "@/test/db/fixtures";
import { signInAs } from "@/test/db/session";
import { createPreset, deletePreset, setPresetActive, updatePreset } from "./presets";
import { ADMIN_PRESET_MESSAGES } from "./presets.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

const NOW = new Date("2026-09-17T04:00:00.000Z");

async function setup() {
  // 6 active questions in А (one inactive), 4 in Б.
  const a = await scope.subject([{}, {}, {}, {}, {}, {}, { isActive: false }], "Статистик");
  const b = await scope.subject(4, "Философи");
  const admin = await scope.user("preset-admin", { create: true });
  const member = await scope.user("preset-member", { create: true });
  signInAs(admin.clerkId, { admin: true });
  return { a, b, admin, member };
}

const body = (overrides: Partial<Parameters<typeof createPreset>[0]> = {}) => ({
  name: "Жишиг шалгалт",
  questionCount: 10,
  timeLimitMin: 60,
  isActive: true,
  sortOrder: 0,
  distribution: null,
  ...overrides,
});

async function create(overrides: Partial<Parameters<typeof createPreset>[0]> = {}) {
  const result = await createPreset(body(overrides));
  expect(result).toHaveProperty("presetId");
  const { presetId } = result as { presetId: string };
  scope.trackPreset(presetId);
  return presetId;
}

const presetById = (id: string) => db.examPreset.findUniqueOrThrow({ where: { id } });

describe("admin exam presets", () => {
  it("refuses everyone who is not an admin", async () => {
    const { member } = await setup();
    const id = await create();

    signInAs(null);
    await expect(createPreset(body())).rejects.toThrow("UNAUTHENTICATED");
    await expect(updatePreset({ presetId: id, ...body() })).rejects.toThrow("UNAUTHENTICATED");
    await expect(setPresetActive({ presetId: id, isActive: false })).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    await expect(deletePreset({ presetId: id })).rejects.toThrow("UNAUTHENTICATED");

    signInAs(member.clerkId);
    await expect(createPreset(body())).rejects.toThrow("NEXT_REDIRECT");
    await expect(updatePreset({ presetId: id, ...body() })).rejects.toThrow("NEXT_REDIRECT");
    await expect(setPresetActive({ presetId: id, isActive: false })).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    await expect(deletePreset({ presetId: id })).rejects.toThrow("NEXT_REDIRECT");

    expect((await presetById(id)).isActive).toBe(true);
  });

  it("creates a preset without a distribution, and refuses one bigger than the bank", async () => {
    await setup();
    const id = await create({ questionCount: 10 });
    expect(await presetById(id)).toMatchObject({ questionCount: 10, distribution: null });

    // 6 active in А plus 4 in Б is 10; the inactive one is not available.
    expect(await createPreset(body({ name: "Хэт том", questionCount: 11 }))).toEqual({
      error: PRESET_MESSAGES.bankTooSmall(11, 10),
    });
    expect(await db.examPreset.count({ where: { name: "Хэт том" } })).toBe(0);
  });

  it("stores a distribution and requires the counts to add up", async () => {
    const { a, b } = await setup();

    expect(
      await createPreset(
        body({ name: "Таарахгүй", questionCount: 10, distribution: { [a.id]: 4, [b.id]: 4 } }),
      ),
    ).toEqual({ error: PRESET_MESSAGES.distributionSum(8, 10) });

    const id = await create({
      name: "Хуваарилсан",
      questionCount: 9,
      distribution: { [a.id]: 5, [b.id]: 4 },
    });
    expect((await presetById(id)).distribution).toEqual({ [a.id]: 5, [b.id]: 4 });
  });

  it("counts only ACTIVE questions when checking a subject's share", async () => {
    const { a, b } = await setup();
    const id = await create({
      name: "Тэнцвэртэй",
      questionCount: 10,
      distribution: { [a.id]: 6, [b.id]: 4 },
    });

    // Deactivating one question in А makes the very same distribution unfillable.
    await db.question.update({ where: { id: a.questionIds[0] }, data: { isActive: false } });
    expect(
      await updatePreset({
        presetId: id,
        ...body({ name: "Тэнцвэртэй", questionCount: 10, distribution: { [a.id]: 6, [b.id]: 4 } }),
      }),
    ).toEqual({ error: PRESET_MESSAGES.subjectTooSmall(a.name, 6, 5) });

    // The stored preset is untouched, and the list marks it as unfillable.
    expect((await presetById(id)).questionCount).toBe(10);
    const listed = (await listAdminPresets()).presets.find((preset) => preset.id === id)!;
    expect(listed.plan.ok).toBe(false);
  });

  it("treats an all-zero distribution as 'the whole bank'", async () => {
    const { a, b } = await setup();
    const id = await create({
      name: "Тэглэсэн",
      questionCount: 8,
      distribution: { [a.id]: 0, [b.id]: 0 },
    });
    expect((await presetById(id)).distribution).toBeNull();
  });

  it("refuses a subject that does not exist", async () => {
    await setup();
    expect(
      await createPreset(
        body({
          name: "Танихгүй",
          questionCount: 5,
          distribution: { cmu0000000000000000000000: 5 },
        }),
      ),
    ).toEqual({ error: PRESET_MESSAGES.subjectNotFound });
  });

  it("validates the name, the question count and the time limit", async () => {
    await setup();
    expect(await createPreset(body({ name: "  " }))).toEqual({
      error: ADMIN_PRESET_MESSAGES.nameRequired,
    });
    expect(await createPreset(body({ questionCount: 0 }))).toEqual({
      error: ADMIN_PRESET_MESSAGES.questionCount,
    });
    expect(await createPreset(body({ timeLimitMin: 0 }))).toEqual({
      error: ADMIN_PRESET_MESSAGES.timeLimit,
    });
    expect(await createPreset(body({ timeLimitMin: 1.5 }))).toEqual({
      error: ADMIN_PRESET_MESSAGES.timeLimit,
    });
  });

  it("activates and deactivates idempotently", async () => {
    await setup();
    const id = await create();

    expect(await setPresetActive({ presetId: id, isActive: false })).toEqual({ isActive: false });
    expect(await setPresetActive({ presetId: id, isActive: false })).toEqual({ isActive: false });
    expect((await presetById(id)).isActive).toBe(false);
    expect(await setPresetActive({ presetId: id, isActive: true })).toEqual({ isActive: true });
  });

  it("deletes an unused preset but only deactivates one an exam was taken with", async () => {
    const { admin } = await setup();
    const unused = await create({ name: "Хэрэглээгүй" });
    const used = await create({ name: "Хэрэглэсэн" });

    await db.attempt.create({
      data: {
        userId: admin.id!,
        mode: AttemptMode.EXAM,
        status: AttemptStatus.SUBMITTED,
        presetId: used,
        timeLimitSec: 3600,
        totalCount: 10,
        correctCount: 7,
        startedAt: NOW,
        submittedAt: NOW,
      },
    });

    expect(await deletePreset({ presetId: used })).toEqual({
      error: ADMIN_PRESET_MESSAGES.hasAttempts(1),
    });
    // Still there, so the exam history keeps the name it was taken under.
    expect((await presetById(used)).name).toBe("Хэрэглэсэн");
    const attempt = await db.attempt.findFirstOrThrow({ where: { presetId: used } });
    expect(attempt.presetId).toBe(used);

    // Deactivating it is the way to retire it.
    expect(await setPresetActive({ presetId: used, isActive: false })).toEqual({ isActive: false });

    expect(await deletePreset({ presetId: unused })).toEqual({ ok: true });
    expect(await db.examPreset.count({ where: { id: unused } })).toBe(0);
    expect(await deletePreset({ presetId: unused })).toEqual({
      error: ADMIN_PRESET_MESSAGES.notFound,
    });
  });

  it("accepts a hand-set preset id, which is not a cuid", async () => {
    await setup();
    const seeded = await db.examPreset.create({
      data: {
        id: "seed-preset-test",
        name: "Үрлэсэн",
        questionCount: 5,
        timeLimitMin: 30,
      },
      select: { id: true },
    });
    scope.trackPreset(seeded.id);

    expect(await setPresetActive({ presetId: seeded.id, isActive: false })).toEqual({
      isActive: false,
    });
    expect(
      await updatePreset({ presetId: seeded.id, ...body({ name: "Үрлэсэн", questionCount: 6 }) }),
    ).toEqual({ ok: true });
    expect((await presetById(seeded.id)).questionCount).toBe(6);
  });

  it("lists presets with their attempt count and the bank the editor shows", async () => {
    const { a, b } = await setup();
    const id = await create({
      name: "Жагсаалт",
      questionCount: 9,
      distribution: { [a.id]: 5, [b.id]: 4 },
    });

    const { presets, bank } = await listAdminPresets();
    expect(bank.total).toBe(10);
    expect(bank.bySubject).toEqual(
      expect.arrayContaining([
        { id: a.id, name: a.name, count: 6 },
        { id: b.id, name: b.name, count: 4 },
      ]),
    );

    const listed = presets.find((preset) => preset.id === id)!;
    expect(listed).toMatchObject({
      attemptCount: 0,
      distribution: { [a.id]: 5, [b.id]: 4 },
      offeredInProduction: true,
    });
    expect(listed.plan.ok).toBe(true);
  });
});
