import { describe, expect, it } from "vitest";
import { slugify, transliterate } from "./slug";

describe("transliterate", () => {
  it("maps Mongolian-specific letters to Latin", () => {
    expect(transliterate("өүхцчшщёюя")).toBe("oukhtschshshchyoyuya");
  });

  it("drops the soft and hard signs", () => {
    expect(transliterate("ъь")).toBe("");
  });

  it("is case insensitive", () => {
    expect(transliterate("ЭРХ")).toBe(transliterate("эрх"));
  });
});

describe("slugify", () => {
  it("slugifies a subject name", () => {
    expect(slugify("Нийтийн эрх зүй")).toBe("niitiin-erkh-zui");
    expect(slugify("Шинжлэх ухааны философи")).toBe("shinjlekh-ukhaany-filosofi");
  });

  it("collapses punctuation and trims separators", () => {
    expect(slugify("  Эрх зүй!!! (нийтийн)  ")).toBe("erkh-zui-niitiin");
  });

  it("keeps digits and Latin text", () => {
    expect(slugify("НЭГДҮГЭЭР БҮЛЭГ 2")).toBe("negdugeer-buleg-2");
  });

  it("returns an empty string when nothing is left", () => {
    expect(slugify("—!!!")).toBe("");
  });

  it("can collide for different names, which commit() resolves with a suffix", () => {
    expect(slugify("Ном")).toBe(slugify("Нөм"));
  });
});
