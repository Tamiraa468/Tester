import { afterEach, describe, expect, it } from "vitest";
import { ReportStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { listReports } from "@/server/queries/admin/reports";
import { TestScope } from "@/test/db/fixtures";
import { signInAs } from "@/test/db/session";
import { setReportStatus } from "./reports";
import { REPORT_MESSAGES } from "./reports.schemas";

const scope = new TestScope();
afterEach(() => scope.cleanup());

async function setup() {
  const bank = await scope.subject(3, "Мэдээлэл");
  const admin = await scope.user("report-admin", { create: true });
  const member = await scope.user("report-member", { create: true });

  const reports = await Promise.all(
    [
      { questionId: bank.questionIds[0], message: "Хариулт буруу байна.", status: ReportStatus.OPEN },
      { questionId: bank.questionIds[1], message: "Үсгийн алдаатай.", status: ReportStatus.OPEN },
      {
        questionId: bank.questionIds[2],
        message: "Аль хэдийн зассан.",
        status: ReportStatus.RESOLVED,
      },
    ].map((data, index) =>
      db.questionReport.create({
        data: {
          ...data,
          userId: member.id!,
          createdAt: new Date(`2026-09-1${index + 1}T04:00:00.000Z`),
        },
        select: { id: true },
      }),
    ),
  );

  signInAs(admin.clerkId, { admin: true });
  return { bank, admin, member, reports };
}

describe("admin reports", () => {
  it("queues open reports first, newest first within a status", async () => {
    const { reports } = await setup();
    const page = await listReports();

    expect(page.total).toBe(3);
    expect(page.open).toBe(2);
    // The two open ones (newest first), then the resolved one.
    expect(page.items.map((item) => item.id)).toEqual([reports[1].id, reports[0].id, reports[2].id]);
    expect(page.items[0].question).toMatchObject({ isActive: true });
    expect(page.items[0].question.code).not.toBe("");
  });

  it("resolves and re-opens, idempotently", async () => {
    const { reports } = await setup();
    const statusOf = async (id: string) =>
      (await db.questionReport.findUniqueOrThrow({ where: { id } })).status;

    expect(await setReportStatus({ reportId: reports[0].id, status: ReportStatus.RESOLVED })).toEqual({
      status: ReportStatus.RESOLVED,
    });
    // A double click must not put it back in the queue.
    expect(await setReportStatus({ reportId: reports[0].id, status: ReportStatus.RESOLVED })).toEqual({
      status: ReportStatus.RESOLVED,
    });
    expect(await statusOf(reports[0].id)).toBe(ReportStatus.RESOLVED);
    expect((await listReports()).open).toBe(1);

    expect(await setReportStatus({ reportId: reports[0].id, status: ReportStatus.OPEN })).toEqual({
      status: ReportStatus.OPEN,
    });
    expect(await statusOf(reports[0].id)).toBe(ReportStatus.OPEN);
  });

  it("reports a bad id instead of silently doing nothing", async () => {
    await setup();
    expect(
      await setReportStatus({
        reportId: "cmu0000000000000000000000",
        status: ReportStatus.RESOLVED,
      }),
    ).toEqual({ error: REPORT_MESSAGES.notFound });
    expect(
      await setReportStatus({ reportId: "not-a-cuid", status: ReportStatus.RESOLVED }),
    ).toEqual({ error: REPORT_MESSAGES.invalid });
  });

  it("refuses everyone who is not an admin", async () => {
    const { member, reports } = await setup();
    const input = { reportId: reports[0].id, status: ReportStatus.RESOLVED };

    signInAs(null);
    await expect(setReportStatus(input)).rejects.toThrow("UNAUTHENTICATED");

    signInAs(member.clerkId);
    await expect(setReportStatus(input)).rejects.toThrow("NEXT_REDIRECT");

    expect(
      (await db.questionReport.findUniqueOrThrow({ where: { id: reports[0].id } })).status,
    ).toBe(ReportStatus.OPEN);
  });
});
