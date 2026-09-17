// Input schemas for src/server/actions/practice.ts. Kept apart from the actions (no
// "use server", no server-only import) so they can be unit-tested and so client
// components can reuse the constants.
//
// z.cuid() only validates ids Prisma generates (@default(cuid())). Hand-set ids, such as
// the seeded ExamPreset "seed-preset-trial", must be validated as plain non-empty strings.

import { z } from "zod";
import { AttemptSource } from "@/generated/prisma/enums";
import { COUNTED_SOURCES, PRACTICE_COUNTS } from "@/server/queries/question-sources";

export const REPORT_MESSAGE_MIN = 5;
export const REPORT_MESSAGE_MAX = 1000;
/** Reports allowed per user in any rolling 24 hours. */
export const REPORTS_PER_DAY = 5;

export const PRACTICE_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  noQuestions: "Тохирох асуулт олдсонгүй. Өөр төрөл эсвэл судлагдахуун сонгоно уу.",
  notFound: "Асуулт олдсонгүй. Хуудсаа дахин ачаална уу.",
  attemptClosed: "Энэ дадлага дууссан байна.",
  noCorrectOption: "Энэ асуултын зөв хариулт тодорхойгүй байна. Алдаа мэдээлнэ үү.",
  reportTooShort: `Тайлбар дор хаяж ${REPORT_MESSAGE_MIN} тэмдэгт байх ёстой.`,
  reportTooLong: `Тайлбар ${REPORT_MESSAGE_MAX} тэмдэгтээс хэтрэхгүй байх ёстой.`,
  reportLimit: `Сүүлийн 24 цагт ${REPORTS_PER_DAY}-аас олон мэдээлэл илгээх боломжгүй.`,
} as const;

const invalid = { error: PRACTICE_MESSAGES.invalid };
const generatedId = z.cuid(invalid);

export const createPracticeAttemptSchema = z.discriminatedUnion(
  "source",
  [
    z.strictObject({
      source: z.enum(COUNTED_SOURCES, invalid),
      subjectId: generatedId.nullish(),
      count: z.literal(PRACTICE_COUNTS, invalid),
    }),
    // A retry: the server derives the questions (and their number) from the attempt.
    z.strictObject({
      source: z.literal(AttemptSource.CUSTOM, invalid),
      fromAttemptId: generatedId,
    }),
  ],
  invalid,
);
export type CreatePracticeAttemptInput = z.input<typeof createPracticeAttemptSchema>;

export const submitPracticeAnswerSchema = z.strictObject({
  attemptItemId: generatedId,
  optionId: generatedId,
});
export type SubmitPracticeAnswerInput = z.input<typeof submitPracticeAnswerSchema>;

export const attemptIdSchema = generatedId;

/** Idempotent: the caller states the state it wants, not "flip it". */
export const setBookmarkSchema = z.strictObject({
  questionId: generatedId,
  bookmarked: z.boolean(invalid),
});
export type SetBookmarkInput = z.input<typeof setBookmarkSchema>;

export const reportQuestionSchema = z.strictObject({
  questionId: generatedId,
  message: z
    .string(invalid)
    .trim()
    .min(REPORT_MESSAGE_MIN, { error: PRACTICE_MESSAGES.reportTooShort })
    .max(REPORT_MESSAGE_MAX, { error: PRACTICE_MESSAGES.reportTooLong }),
});
export type ReportQuestionInput = z.input<typeof reportQuestionSchema>;

/** Every schema above carries a Mongolian message, so the first issue is shown as is. */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? PRACTICE_MESSAGES.invalid;
}
