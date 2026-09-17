// Input rules and limits for src/server/actions/admin/import.ts.
//
// Vercel's functions accept a request body of at most 4.5 MB, so the upload itself is
// capped below that and next.config.ts raises serverActions.bodySizeLimit to 4.5mb;
// without both, a large file would be rejected by the platform before any of this runs.

import { z } from "zod";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";
/** Data rows (the header does not count). */
export const MAX_DATA_ROWS = 5000;
/** Valid rows shown in the preview table. */
export const PREVIEW_SAMPLE_SIZE = 50;
/** Upper bound on the issue list, so one hopeless file cannot return megabytes. */
export const PREVIEW_MAX_ISSUES = 1000;

export const SUPPORTED_EXTENSIONS = [".xlsx", ".csv"] as const;

export const IMPORT_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  noFile: "Файл сонгоно уу.",
  empty: "Файл хоосон байна.",
  tooLarge: `Файл ${MAX_UPLOAD_LABEL}-аас том байна.`,
  badExtension: "Зөвхөн .xlsx эсвэл .csv файл дэмжигдэнэ.",
  tooManyRows: (rows: number) =>
    `Файлд ${rows} мөр байна; нэг удаад хамгийн ихдээ ${MAX_DATA_ROWS} мөр импортлоно. ` +
    "Файлаа хувааж оруулна уу.",
  unreadable: (detail: string) => `Файлыг уншиж чадсангүй: ${detail}`,
  hasErrors: "Файлд алдаа байгаа тул импортлохгүй. Алдааг засаад дахин оруулна уу.",
  needsConfirmation:
    "Зөв хариулт өөрчлөгдөж буй асуултууд байна. Баталгаажуулсны дараа дахин оролдоно уу.",
} as const;

const invalid = { error: IMPORT_MESSAGES.invalid };

export function hasSupportedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

export const uploadSchema = z.strictObject(
  {
    file: z
      .instanceof(File, { error: IMPORT_MESSAGES.noFile })
      .refine((file) => file.size > 0, { error: IMPORT_MESSAGES.empty })
      .refine((file) => file.size <= MAX_UPLOAD_BYTES, { error: IMPORT_MESSAGES.tooLarge })
      .refine((file) => hasSupportedExtension(file.name), {
        error: IMPORT_MESSAGES.badExtension,
      }),
    /** Set once the admin has accepted the answer-key changes the preview listed. */
    confirmAnswerChanges: z.boolean(invalid),
  },
  invalid,
);
export type UploadInput = z.input<typeof uploadSchema>;

/** Pulls the action's inputs out of the posted form. */
export function readUploadForm(formData: FormData): { file: unknown; confirmAnswerChanges: boolean } {
  return {
    file: formData.get("file"),
    confirmAnswerChanges: formData.get("confirmAnswerChanges") === "1",
  };
}
