// Input schemas for src/server/actions/exam.ts (no "use server", no server-only import,
// so they can be unit-tested).
//
// ExamPreset ids are hand-set by the seed (e.g. "seed-preset-trial"), so presetId is a
// plain non-empty string. Attempt and item ids are generated, so they are cuids.

import { z } from "zod";

export const EXAM_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  presetNotFound: "Шалгалтын төрөл олдсонгүй.",
  notFound: "Шалгалт олдсонгүй. Хуудсаа дахин ачаална уу.",
  closed: "Шалгалт дууссан байна.",
  timeUp: "Шалгалтын хугацаа дууссан тул хариулт хадгалагдсангүй.",
  bankChanged: "Асуултын сан өөрчлөгдсөн байна. Дахин оролдоно уу.",
} as const;

const invalid = { error: EXAM_MESSAGES.invalid };
const generatedId = z.cuid(invalid);

export const presetIdSchema = z.string(invalid).trim().min(1, invalid).max(191, invalid);
export const examAttemptIdSchema = generatedId;
export const attemptItemIdSchema = generatedId;

export const saveExamAnswerSchema = z.strictObject({
  attemptItemId: generatedId,
  /** null clears the answer. */
  optionId: generatedId.nullable(),
});
export type SaveExamAnswerInput = z.input<typeof saveExamAnswerSchema>;
