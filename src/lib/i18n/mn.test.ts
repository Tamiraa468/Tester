import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOURCE_LABELS } from "@/components/practice/source-labels";
import { AttemptSource } from "@/generated/prisma/enums";
import { mn, vocab } from "@/lib/i18n/mn";

/** Everything under src/, minus the places a literal is legitimately hand-written. */
const ROOTS = ["src/app", "src/components"];
const EXCLUDED = [
  // The vocabulary itself, and the label maps that derive from it.
  join("src", "lib", "i18n"),
  // The developer showcase is fixtures, not product copy.
  join("src", "app", "dev"),
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (EXCLUDED.some((excluded) => path.startsWith(excluded))) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [path] : [];
  });
}

describe("mn vocabulary", () => {
  it("is what the label maps are built from", () => {
    // REVIEW_TAB_LABELS is checked through its source rather than imported: its module
    // also pulls in server-only queries, which cannot load in this environment.
    const reviewTabs = readFileSync(join("src", "components", "review", "review-tabs.tsx"), "utf8");
    expect(reviewTabs).toContain("[AttemptSource.DUE]: mn.review.due");
    expect(reviewTabs).toContain("[AttemptSource.WRONG]: mn.review.wrong");
    expect(reviewTabs).toContain("[AttemptSource.BOOKMARKED]: mn.review.bookmarked");
    expect(mn.review.due).toBe(vocab.review);
    expect(mn.review.wrong).toBe(vocab.wrong);
    expect(mn.review.bookmarked).toBe(vocab.bookmarked);
    expect(SOURCE_LABELS[AttemptSource.BOOKMARKED].label).toBe(vocab.bookmarked);
    expect(mn.nav.dashboard).toBe(vocab.dashboard);
    expect(mn.nav.practice).toBe(vocab.practice);
    expect(mn.nav.exam).toBe(vocab.exam);
    expect(mn.nav.review).toBe(vocab.review);
  });

  it("has no two entries sharing one word", () => {
    const words = Object.values(vocab);
    expect(new Set(words).size).toBe(words.length);
  });

  /**
   * The point of a vocabulary file is defeated the moment someone types one of its
   * words into a component instead of importing it. This catches a canonical term used
   * on its own — as a whole string literal, or as a whole JSX text node — outside
   * src/lib/i18n. A term inside a longer sentence is prose, and is left alone.
   */
  it("is imported rather than retyped", () => {
    const offences: string[] = [];
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        // Comments are where the rule gets *explained* ("never call it Тэмдэглэсэн"),
        // so they are stripped before the scan rather than counted as offences.
        const text = readFileSync(file, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/.*$/gm, "$1");
        for (const term of Object.values(vocab)) {
          const standalone = new RegExp(`(["'\`]${term}["'\`])|(>\\s*${term}\\s*<)`, "u");
          if (standalone.test(text)) offences.push(`${file}: ${term}`);
        }
      }
    }
    expect(offences).toEqual([]);
  });
});
