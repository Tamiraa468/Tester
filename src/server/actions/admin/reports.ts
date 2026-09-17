"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ReportStatus } from "@/generated/prisma/enums";
import { REPORT_MESSAGES, setReportStatusSchema, type SetReportStatusInput } from "./reports.schemas";

export type AdminActionError = { error: string };

/** Resolves a report, or puts it back in the queue. */
export async function setReportStatus(
  input: SetReportStatusInput,
): Promise<{ status: ReportStatus } | AdminActionError> {
  await auth.protect();
  await requireAdmin();
  const parsed = setReportStatusSchema.safeParse(input);
  if (!parsed.success) return { error: REPORT_MESSAGES.invalid };
  const { reportId, status } = parsed.data;

  const { count } = await db.questionReport.updateMany({ where: { id: reportId }, data: { status } });
  if (count === 0) return { error: REPORT_MESSAGES.notFound };

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  return { status };
}
