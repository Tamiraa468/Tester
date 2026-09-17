// The rules a question must satisfy, in one place, for both ways a question enters the
// bank: a spreadsheet row (validate.ts) and the admin form (src/server/actions/admin).
// Nothing here depends on Next.js or on Prisma.
//
// The warning predicates live in validate.ts and are reused as they are, so the admin
// form warns about exactly what an import warns about.

import { z } from "zod";
import { normalizeText } from "./parse";
import { OPTION_COLUMN_COUNT } from "./types";
import { looksLikeAllOrNone, mixedScriptWords, referencesOtherOptions } from "./validate";

export const OPTION_MIN = 2;
export const OPTION_MAX = OPTION_COLUMN_COUNT;

export const QUESTION_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  code: "Код хоосон байж болохгүй.",
  subject: "Судлагдахуун сонгоно уу.",
  text: "Асуултын текст хоосон байж болохгүй.",
  optionText: "Хувилбарын текст хоосон байж болохгүй.",
  tooFewOptions: `Хамгийн багадаа ${OPTION_MIN} хувилбар байх ёстой.`,
  tooManyOptions: `Хамгийн ихдээ ${OPTION_MAX} хувилбар байж болно.`,
  oneCorrect: "Яг нэг хувилбарыг зөв гэж сонгоно уу.",
  imageUrl: "Зургийн хаяг (URL) буруу байна.",
} as const;

/** NFC, no exotic spaces, collapsed whitespace — the same normalization an import does. */
const normalized = z.string().transform(normalizeText);

const requiredText = (message: string) => normalized.pipe(z.string().min(1, { error: message }));

export const optionRowSchema = z.strictObject(
  {
    text: requiredText(QUESTION_MESSAGES.optionText),
    isCorrect: z.boolean(),
    pinned: z.boolean(),
  },
  // Passed so an unexpected key cannot surface Zod's English "Unrecognized key" text.
  { error: QUESTION_MESSAGES.invalid },
);

export type OptionRowInput = z.input<typeof optionRowSchema>;

/**
 * 2-6 options with exactly one correct one — the rule the "correct" column encodes.
 * Takes the row schema so a caller can carry extra fields (the admin editor adds the
 * existing option's id) without restating the list rules.
 */
export function optionRowsOf<Row extends { isCorrect: boolean }>(
  row: z.ZodType<Row, unknown>,
) {
  return z
    .array(row)
    .min(OPTION_MIN, { error: QUESTION_MESSAGES.tooFewOptions })
    .max(OPTION_MAX, { error: QUESTION_MESSAGES.tooManyOptions })
    .refine((options) => options.filter((option) => option.isCorrect).length === 1, {
      error: QUESTION_MESSAGES.oneCorrect,
    });
}

export const optionRowsSchema = optionRowsOf(optionRowSchema);

/** Field schemas, so a caller can compose them with its own subject field. */
export const questionFields = {
  code: requiredText(QUESTION_MESSAGES.code),
  text: requiredText(QUESTION_MESSAGES.text),
  explanation: normalized,
  imageUrl: normalized.pipe(
    z.union([z.literal(""), z.url({ error: QUESTION_MESSAGES.imageUrl })]),
  ),
  lockOptions: z.boolean(),
  options: optionRowsSchema,
} as const;

/** "" from an optional text field is stored as NULL, never as an empty string. */
export function emptyToNull(value: string): string | null {
  return value === "" ? null : value;
}

export type WarningInput = {
  text?: string;
  subjectName?: string;
  lockOptions: boolean;
  options: readonly { text: string; pinned: boolean }[];
};

/**
 * Non-blocking notes, worded as in validate.ts: a "Бүгд зөв" option that is not pinned,
 * options that reference each other by letter without lock, duplicated option texts and
 * words mixing Latin with Cyrillic.
 */
export function questionWarnings(input: WarningInput): string[] {
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const option of input.options) {
    const key = option.text.toLowerCase();
    if (option.text !== "" && seen.has(key)) {
      warnings.push(`"${option.text}" хувилбар давхардсан.`);
    }
    seen.add(key);

    if (looksLikeAllOrNone(option.text) && !option.pinned) {
      warnings.push(
        `"${option.text}" хувилбар "Бүгд зөв" төрлийн боловч "Төгсгөлд тогтмол" сонгоогүй байна.`,
      );
    }

    if (referencesOtherOptions(option.text) && !input.lockOptions) {
      warnings.push(
        `"${option.text}" хувилбар бусад хувилбарыг үсэг/дугаараар иш татсан ` +
          "боловч дарааллыг түгжээгүй байна.",
      );
    }
  }

  const haystack = [input.subjectName ?? "", input.text ?? "", ...input.options.map((o) => o.text)]
    .join(" ")
    .trim();
  for (const word of mixedScriptWords(haystack)) {
    warnings.push(`"${word}" үгэнд латин ба кирилл үсэг хольсон байна.`);
  }

  return warnings;
}
