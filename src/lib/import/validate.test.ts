import { describe, expect, it } from "vitest";
import { parseRows } from "./parse";
import { HEADERS, type Header, type RawRow } from "./types";
import { validate } from "./validate";

function rawRow(values: Partial<Record<Header, string>>, rowNumber: number): RawRow {
  const cells = Object.fromEntries(HEADERS.map((header) => [header, ""])) as Record<Header, string>;
  return { rowNumber, cells: { ...cells, ...values } };
}

const base = {
  code: "Q-1",
  subject: "Нийтийн эрх зүй",
  question: "Асуулт?",
  option_1: "Нэг",
  option_2: "Хоёр",
  option_3: "Гурав",
  option_4: "Дөрөв",
  correct: "a",
};

function check(rows: Partial<Record<Header, string>>[]) {
  const raw = rows.map((values, index) => rawRow({ ...base, ...values }, index + 2));
  return validate(parseRows(raw).rows);
}

const messages = (issues: { message: string }[]) => issues.map((issue) => issue.message).join(" | ");

describe("validate — valid rows", () => {
  it("accepts a well formed row and strips the parse-only fields", () => {
    const { valid, errors, warnings } = check([{}]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(valid).toHaveLength(1);
    expect(valid[0]).not.toHaveProperty("correctRef");
    expect(valid[0]).not.toHaveProperty("optionColumns");
  });

  it("accepts a pinned 'Бүгд зөв' row and a locked row without warnings", () => {
    const { errors, warnings } = check([
      { option_4: "Бүгд зөв", correct: "d", pinned: "d" },
      { code: "Q-2", question: "Өөр асуулт?", option_4: "А ба В зөв", correct: "d", lock: "1" },
    ]);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe("validate — errors", () => {
  it("reports a missing code", () => {
    const { errors, valid } = check([{ code: "" }]);
    expect(messages(errors)).toContain("code");
    expect(valid).toEqual([]);
  });

  it("reports a missing subject", () => {
    expect(messages(check([{ subject: "" }]).errors)).toContain("subject");
  });

  it("reports a missing question", () => {
    expect(messages(check([{ question: "" }]).errors)).toContain("question");
  });

  it("reports fewer than two options", () => {
    const { errors } = check([{ option_2: "", option_3: "", option_4: "" }]);
    expect(messages(errors)).toContain("Хувилбар хоёроос бага");
  });

  it("reports a missing correct answer", () => {
    expect(messages(check([{ correct: "" }]).errors)).toContain("correct (зөв хариулт) хоосон");
  });

  it("reports an ambiguous correct answer", () => {
    expect(messages(check([{ correct: "б" }]).errors)).toContain("эргэлзээтэй");
  });

  it("reports a correct answer pointing at an empty option", () => {
    expect(messages(check([{ correct: "e" }]).errors)).toContain("хоосон option_5");
  });

  it("reports a duplicate code within the file", () => {
    const { errors } = check([{}, { question: "Өөр асуулт?" }]);
    expect(messages(errors)).toContain('code "Q-1" файлд давхардсан');
    expect(errors).toHaveLength(2);
  });

  it("reports pinned out of range", () => {
    expect(messages(check([{ pinned: "f" }]).errors)).toContain("хоосон option_6");
    expect(messages(check([{ pinned: "9" }]).errors)).toContain("эргэлзээтэй");
  });
});

describe("validate — warnings", () => {
  it("warns about duplicate question text but still imports the rows", () => {
    const { warnings, valid } = check([{}, { code: "Q-2" }]);
    expect(messages(warnings)).toContain("давхардаж байна");
    expect(valid).toHaveLength(2);
  });

  it("warns about a duplicate option text inside one question", () => {
    const { warnings, valid } = check([{ option_3: "Нэг" }]);
    expect(messages(warnings)).toContain('"Нэг" хувилбар давхардсан');
    expect(valid).toHaveLength(1);
  });

  it("warns about an unpinned all/none-of-the-above option", () => {
    for (const text of [
      "Бүгд зөв",
      "Бүгд буруу",
      "Аль нь ч биш",
      "Дээрх бүгд",
      "Дээрхийн аль нь ч биш",
    ]) {
      expect(messages(check([{ option_4: text }]).warnings)).toContain("pinned-д заагаагүй");
    }
  });

  it("does not warn when such an option is pinned", () => {
    expect(check([{ option_4: "Бүгд зөв", pinned: "d" }]).warnings).toEqual([]);
  });

  it("warns when options reference each other and lock is unset", () => {
    for (const text of ["a ба b", "А ба В", "1 ба 3"]) {
      expect(messages(check([{ option_4: text }]).warnings)).toContain("иш татсан");
    }
  });

  it("does not warn about references when lock is set", () => {
    expect(check([{ option_4: "a ба b", lock: "1" }]).warnings).toEqual([]);
  });

  it("warns about words mixing Latin and Cyrillic letters", () => {
    expect(messages(check([{ option_2: "Cоциализм" }]).warnings)).toContain("хольсон байна");
  });

  it("does not warn about clean Latin or clean Cyrillic words", () => {
    expect(check([{ question: "PhD хамгаалалт гэж юу вэ?" }]).warnings).toEqual([]);
  });
});
