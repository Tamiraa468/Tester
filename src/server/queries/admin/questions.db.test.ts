import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TestScope } from "@/test/db/fixtures";
import {
  ADMIN_PAGE_SIZE,
  EMPTY_FILTERS,
  parseQuestionFilters,
  type QuestionFilters,
} from "./question-filters";
import { getAdminQuestion, listAdminQuestions } from "./questions";

const scope = new TestScope();
afterEach(() => scope.cleanup());

type QuestionSpec = {
  code: string;
  text: string;
  explanation?: string | null;
  isActive?: boolean;
  lockOptions?: boolean;
  pinnedLast?: boolean;
};

async function makeQuestion(subjectId: string, spec: QuestionSpec): Promise<string> {
  const question = await db.question.create({
    data: {
      code: spec.code,
      subjectId,
      text: spec.text,
      explanation: spec.explanation ?? null,
      isActive: spec.isActive ?? true,
      lockOptions: spec.lockOptions ?? false,
      options: {
        create: [
          { text: "Нэг", isCorrect: false, pinned: false, sortOrder: 0 },
          { text: "Хоёр", isCorrect: true, pinned: false, sortOrder: 1 },
          { text: "Бүгд зөв", isCorrect: false, pinned: spec.pinnedLast ?? false, sortOrder: 2 },
        ],
      },
    },
    select: { id: true },
  });
  return scope.trackQuestion(question.id);
}

const filters = (overrides: Partial<QuestionFilters> = {}): QuestionFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

async function setup() {
  const subject = await scope.subject(0, "Хайлт");
  const other = await scope.subject(0, "Бусад");
  const ids = {
    tsets: await makeQuestion(subject.id, {
      code: "TSETS-1",
      text: "Цэцэрлэгийн судалгааны арга",
      explanation: "Тайлбар",
    }),
    plain: await makeQuestion(subject.id, { code: "PLAIN-2", text: "Энгийн асуулт" }),
    inactive: await makeQuestion(subject.id, {
      code: "OFF-3",
      text: "Идэвхгүй асуулт",
      isActive: false,
      explanation: "Тайлбар",
    }),
    locked: await makeQuestion(subject.id, {
      code: "LOCK-4",
      text: "Түгжээтэй асуулт",
      explanation: "Тайлбар",
      lockOptions: true,
    }),
    pinned: await makeQuestion(other.id, {
      code: "PIN-5",
      text: "Тогтмол хувилбартай асуулт",
      explanation: "Тайлбар",
      pinnedLast: true,
    }),
  };
  return { subject, other, ids };
}

describe("listAdminQuestions", () => {
  it("finds Cyrillic text case-insensitively", async () => {
    const { ids } = await setup();

    // The database's collation has to fold Ц -> ц for this to work.
    for (const term of ["цэц", "Цэц", "ЦЭЦЭРЛЭГ", "цэцэрлэгийн судалгаа"]) {
      const found = await listAdminQuestions(filters({ q: term }));
      expect(found.items.map((item) => item.id), term).toEqual([ids.tsets]);
    }
  });

  it("searches the code the same way, and matches either column", async () => {
    const { ids } = await setup();

    expect((await listAdminQuestions(filters({ q: "tsets" }))).items.map((i) => i.id)).toEqual([
      ids.tsets,
    ]);
    expect((await listAdminQuestions(filters({ q: "LOCK" }))).items.map((i) => i.id)).toEqual([
      ids.locked,
    ]);
    expect((await listAdminQuestions(filters({ q: "асуулт" }))).total).toBe(4);
    expect((await listAdminQuestions(filters({ q: "байхгүй үг" }))).items).toEqual([]);
  });

  it("filters by subject, activity, explanation, pinned options and lock", async () => {
    const { subject, other, ids } = await setup();

    const idsFor = async (overrides: Partial<QuestionFilters>) =>
      (await listAdminQuestions(filters(overrides))).items.map((item) => item.id).sort();

    expect(await idsFor({ subjectId: other.id })).toEqual([ids.pinned]);
    expect(await idsFor({ subjectId: subject.id })).toEqual(
      [ids.tsets, ids.plain, ids.inactive, ids.locked].sort(),
    );
    expect(await idsFor({ active: "inactive" })).toEqual([ids.inactive]);
    expect(await idsFor({ active: "active" })).toEqual(
      [ids.tsets, ids.plain, ids.locked, ids.pinned].sort(),
    );
    expect(await idsFor({ missingExplanation: true })).toEqual([ids.plain]);
    expect(await idsFor({ hasPinned: true })).toEqual([ids.pinned]);
    expect(await idsFor({ locked: true })).toEqual([ids.locked]);
    // Filters combine.
    expect(await idsFor({ subjectId: subject.id, active: "active", locked: true })).toEqual([
      ids.locked,
    ]);
  });

  it("reports the flags and counts each row shows", async () => {
    const { ids } = await setup();
    const page = await listAdminQuestions(filters({ q: "PIN-5" }));
    expect(page.items[0]).toMatchObject({
      id: ids.pinned,
      code: "PIN-5",
      optionCount: 3,
      pinnedCount: 1,
      hasExplanation: true,
      isActive: true,
      answerCount: 0,
    });
  });

  it("pages, ordered by code, and clamps a page that does not exist", async () => {
    const subject = await scope.subject(0, "Хуудас");
    for (let index = 0; index < ADMIN_PAGE_SIZE + 3; index += 1) {
      await makeQuestion(subject.id, {
        code: `PAGE-${String(index).padStart(3, "0")}`,
        text: `Асуулт ${index}`,
      });
    }

    const first = await listAdminQuestions(filters({ q: "PAGE-", page: 1 }));
    expect(first.total).toBe(ADMIN_PAGE_SIZE + 3);
    expect(first.pageCount).toBe(2);
    expect(first.items).toHaveLength(ADMIN_PAGE_SIZE);
    expect(first.items[0].code).toBe("PAGE-000");

    const second = await listAdminQuestions(filters({ q: "PAGE-", page: 2 }));
    expect(second.items).toHaveLength(3);
    expect(second.items.at(-1)!.code).toBe(`PAGE-${String(ADMIN_PAGE_SIZE + 2).padStart(3, "0")}`);

    expect((await listAdminQuestions(filters({ q: "PAGE-", page: 99 }))).page).toBe(2);
    expect((await listAdminQuestions(filters({ q: "PAGE-", page: 0 }))).page).toBe(1);
  });
});

describe("parseQuestionFilters", () => {
  it("takes only what it recognizes", () => {
    expect(parseQuestionFilters({})).toEqual(EMPTY_FILTERS);
    expect(
      parseQuestionFilters({
        q: " цэц ",
        subject: "s1",
        active: "inactive",
        hasPinned: "1",
        locked: "0",
        page: "3",
      }),
    ).toEqual({
      q: "цэц",
      subjectId: "s1",
      active: "inactive",
      missingExplanation: false,
      hasPinned: true,
      locked: false,
      page: 3,
    });
    // Unknown values fall back instead of reaching the query.
    expect(parseQuestionFilters({ active: "drop table", page: "-4" })).toMatchObject({
      active: "all",
      page: 1,
    });
    expect(parseQuestionFilters({ q: ["a", "b"] })).toMatchObject({ q: "" });
  });
});

describe("getAdminQuestion", () => {
  it("returns the options in order with their ids, and null for an unknown id", async () => {
    const { subject } = await setup();
    const id = await makeQuestion(subject.id, { code: "ONE-9", text: "Ганц" });

    const question = (await getAdminQuestion(id))!;
    expect(question.options.map((option) => option.sortOrder)).toEqual([0, 1, 2]);
    expect(question.options.every((option) => option.id !== "")).toBe(true);
    expect(question.attemptCount).toBe(0);
    expect(question.progressUserCount).toBe(0);

    expect(await getAdminQuestion("cmu0000000000000000000000")).toBeNull();
  });
});
