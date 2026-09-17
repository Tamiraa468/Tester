import { describe, expect, it } from "vitest";
import {
  emptyToNull,
  optionRowSchema,
  optionRowsSchema,
  questionFields,
  questionWarnings,
  QUESTION_MESSAGES,
} from "./question-schema";

const option = (text: string, isCorrect = false, pinned = false) => ({ text, isCorrect, pinned });

describe("optionRowsSchema", () => {
  it("accepts 2 to 6 options with exactly one correct", () => {
    expect(optionRowsSchema.safeParse([option("а", true), option("б")]).success).toBe(true);
    expect(
      optionRowsSchema.safeParse(Array.from({ length: 6 }, (_, i) => option(`х${i}`, i === 0)))
        .success,
    ).toBe(true);
  });

  it("rejects no correct option, two correct options and the wrong count", () => {
    const messageOf = (input: unknown) => {
      const result = optionRowsSchema.safeParse(input);
      return result.success ? null : result.error.issues[0].message;
    };
    expect(messageOf([option("а"), option("б")])).toBe(QUESTION_MESSAGES.oneCorrect);
    expect(messageOf([option("а", true), option("б", true)])).toBe(QUESTION_MESSAGES.oneCorrect);
    expect(messageOf([option("а", true)])).toBe(QUESTION_MESSAGES.tooFewOptions);
    expect(messageOf(Array.from({ length: 7 }, (_, i) => option(`х${i}`, i === 0)))).toBe(
      QUESTION_MESSAGES.tooManyOptions,
    );
  });

  it("normalizes option text and refuses a blank one", () => {
    const parsed = optionRowsSchema.parse([option("  Зөв  хариулт ", true), option("б")]);
    expect(parsed[0].text).toBe("Зөв хариулт");
    expect(optionRowsSchema.safeParse([option("   ", true), option("б")]).success).toBe(false);
  });
});

describe("optionRowSchema", () => {
  it("refuses an unexpected key in Mongolian, so no Zod English reaches the UI", () => {
    const result = optionRowSchema.safeParse({
      text: "Нэг",
      isCorrect: true,
      pinned: false,
      unexpected: 1,
    });
    expect(result.success).toBe(false);
    expect(result.success || result.error.issues[0].message).toBe(QUESTION_MESSAGES.invalid);
  });
});

describe("questionFields", () => {
  it("normalizes and requires code and text", () => {
    expect(questionFields.code.parse(" ARG-001 ")).toBe("ARG-001");
    expect(questionFields.text.safeParse("  ").success).toBe(false);
  });

  it("accepts an empty image URL but not a broken one", () => {
    expect(questionFields.imageUrl.parse("")).toBe("");
    expect(questionFields.imageUrl.parse(" https://a.mn/x.png ")).toBe("https://a.mn/x.png");
    const bad = questionFields.imageUrl.safeParse("зураг.png");
    expect(bad.success).toBe(false);
    expect(bad.success || bad.error.issues[0].message).toBe(QUESTION_MESSAGES.imageUrl);
  });

  it("maps an empty optional field to null", () => {
    expect(emptyToNull("")).toBeNull();
    expect(emptyToNull("Тайлбар")).toBe("Тайлбар");
  });
});

describe("questionWarnings", () => {
  it("warns about an unpinned 'Бүгд зөв' option", () => {
    const warnings = questionWarnings({
      lockOptions: false,
      options: [option("Нэг"), option("Бүгд зөв", true)],
    });
    expect(warnings.join(" ")).toContain("Төгсгөлд тогтмол");
  });

  it("stays quiet once that option is pinned", () => {
    const warnings = questionWarnings({
      lockOptions: false,
      options: [option("Нэг"), option("Бүгд зөв", true, true)],
    });
    expect(warnings).toEqual([]);
  });

  it("warns about cross-referencing options without lock, and not with it", () => {
    const options = [option("Нэг"), option("Хоёр"), option("a ба b")];
    expect(questionWarnings({ lockOptions: false, options }).join(" ")).toContain("дарааллыг түгжээгүй");
    expect(questionWarnings({ lockOptions: true, options })).toEqual([]);
  });

  it("warns about duplicated options and mixed scripts", () => {
    const warnings = questionWarnings({
      text: "Аpxив гэж юу вэ?",
      lockOptions: false,
      options: [option("Нэг"), option("нэг")],
    });
    expect(warnings.some((warning) => warning.includes("давхардсан"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("кирилл үсэг хольсон"))).toBe(true);
  });
});
