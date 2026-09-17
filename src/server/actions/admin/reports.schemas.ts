import { z } from "zod";
import { ReportStatus } from "@/generated/prisma/enums";

export const REPORT_MESSAGES = {
  invalid: "Хүсэлт буруу байна. Хуудсаа дахин ачаална уу.",
  notFound: "Мэдээлэл олдсонгүй.",
} as const;

const invalid = { error: REPORT_MESSAGES.invalid };

/** Idempotent: the caller states the status it wants, so a double click cannot flip it. */
export const setReportStatusSchema = z.strictObject(
  { reportId: z.cuid(invalid), status: z.enum(ReportStatus, invalid) },
  invalid,
);
export type SetReportStatusInput = z.input<typeof setReportStatusSchema>;
