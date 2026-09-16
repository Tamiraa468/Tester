// Mongolian Cyrillic -> Latin transliteration for Subject.slug.
// Slugs are ASCII so they stay usable in URLs; the display name keeps the Cyrillic text.

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ө: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ү: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function transliterate(value: string): string {
  let result = "";
  for (const char of value.normalize("NFC").toLowerCase()) {
    result += CYRILLIC_TO_LATIN[char] ?? char;
  }
  return result;
}

// "Нийтийн эрх зүй" -> "niitiin-erkh-zui". Different names can still collide
// (ө and о both become "o"), so callers that need a unique Subject.slug add a suffix.
export function slugify(value: string): string {
  return transliterate(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
