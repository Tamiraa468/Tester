// Input schemas for src/server/actions/admin/questions.ts. No "use server" and no
// server-only import, so they can be unit-tested and the form can reuse the constants.
//
// The question rules themselves (2-6 options, exactly one correct, normalization) come
// from src/lib/import/question-schema.ts, which the spreadsheet import shares.

import { z } from "zod";
import {
  optionRowSchema,
  optionRowsOf,
  questionFields,
  QUESTION_MESSAGES,
} from "@/lib/import/question-schema";

export const ADMIN_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  notFound: "Асуулт олдсонгүй.",
  duplicateCode: (code: string) => `"${code}" код бүхий асуулт аль хэдийн байна.`,
  unknownOption: "Хувилбар энэ асуултынх биш байна. Хуудсаа дахин ачаална уу.",
  cannotDeleteOptions:
    "Энэ асуултад оролдлого бүртгэгдсэн тул хувилбарыг устгах боломжгүй. " +
    "Оронд нь асуултыг идэвхгүй болгоно уу.",
  subjectNotFound: "Судлагдахуун олдсонгүй.",
} as const;

const invalid = { error: ADMIN_MESSAGES.invalid };
const generatedId = z.cuid(invalid);

/** An editor row: an existing option (with its id) or a row the admin just added. */
export const adminOptionRowSchema = optionRowSchema.extend({
  optionId: generatedId.nullish(),
});

const adminOptionRows = optionRowsOf(adminOptionRowSchema);

const questionBody = {
  subjectId: z.cuid({ error: QUESTION_MESSAGES.subject }),
  text: questionFields.text,
  imageUrl: questionFields.imageUrl,
  explanation: questionFields.explanation,
  lockOptions: questionFields.lockOptions,
  options: adminOptionRows,
} as const;

/** The code is written once, on create: imports match existing questions by code. */
export const createQuestionSchema = z.strictObject(
  { code: questionFields.code, ...questionBody },
  invalid,
);
export type CreateQuestionInput = z.input<typeof createQuestionSchema>;

/** No code field at all, so an edit cannot change it. */
export const updateQuestionSchema = z.strictObject(
  {
    questionId: generatedId,
    ...questionBody,
    /** Set once the admin has confirmed resetting everyone's progress. */
    confirmAnswerChange: z.boolean().default(false),
  },
  invalid,
);
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export const setQuestionActiveSchema = z.strictObject(
  { questionId: generatedId, isActive: z.boolean(invalid) },
  invalid,
);
export type SetQuestionActiveInput = z.input<typeof setQuestionActiveSchema>;

/** The live preview works on an unsaved draft, so its rows carry no ids. */
export const previewOptionOrdersSchema = z.strictObject(
  {
    lockOptions: z.boolean(invalid),
    options: z
      .array(
        z.strictObject(
          { text: z.string(invalid), isCorrect: z.boolean(), pinned: z.boolean() },
          invalid,
        ),
      )
      .min(1, invalid)
      .max(6, invalid),
  },
  invalid,
);
export type PreviewOptionOrdersInput = z.input<typeof previewOptionOrdersSchema>;

export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? ADMIN_MESSAGES.invalid;
}
