import { z } from "zod";

export const SUBJECT_NAME_MAX = 120;

export const SUBJECT_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  notFound: "Судлагдахуун олдсонгүй.",
  nameRequired: "Нэр хоосон байж болохгүй.",
  nameTooLong: `Нэр ${SUBJECT_NAME_MAX} тэмдэгтээс хэтрэхгүй байх ёстой.`,
  duplicateName: (name: string) => `"${name}" нэртэй судлагдахуун аль хэдийн байна.`,
  hasQuestions: (count: number) =>
    `Энэ судлагдахуунд ${count} асуулт байгаа тул устгах боломжгүй. ` +
    "Эхлээд асуултуудыг өөр судлагдахуун руу шилжүүлнэ үү.",
} as const;

const invalid = { error: SUBJECT_MESSAGES.invalid };
const generatedId = z.cuid(invalid);

const name = z
  .string({ error: SUBJECT_MESSAGES.nameRequired })
  .trim()
  .min(1, { error: SUBJECT_MESSAGES.nameRequired })
  .max(SUBJECT_NAME_MAX, { error: SUBJECT_MESSAGES.nameTooLong });

const sortOrder = z.int(invalid).min(0, invalid).max(9999, invalid);

export const createSubjectSchema = z.strictObject({ name, sortOrder }, invalid);
export type CreateSubjectInput = z.input<typeof createSubjectSchema>;

/**
 * No slug field: renaming a subject keeps the slug it was created with, so links and
 * anything already pointing at it stay valid.
 */
export const updateSubjectSchema = z.strictObject(
  { subjectId: generatedId, name, sortOrder },
  invalid,
);
export type UpdateSubjectInput = z.input<typeof updateSubjectSchema>;

export const deleteSubjectSchema = z.strictObject({ subjectId: generatedId }, invalid);
export type DeleteSubjectInput = z.input<typeof deleteSubjectSchema>;
