import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ReviewTable } from "@/components/admin/review-table";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminCounts,
  listQuestionsNeedingReview,
  REVIEW_MIN_USERS,
} from "@/server/queries/admin/overview";

export const metadata: Metadata = { title: "Админ" };

export default async function AdminPage() {
  // Layouts don't re-run on client navigation, so the page checks the role too.
  await auth.protect();
  await requireAdmin();

  const [counts, review] = await Promise.all([getAdminCounts(), listQuestionsNeedingReview()]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Админ</h1>
        <p className="text-sm text-muted-foreground">Асуултын сан, хэрэглэгчийн идэвх.</p>
      </div>

      <section aria-labelledby="counts-heading" className="flex flex-col gap-3">
        <h2 id="counts-heading" className="sr-only">
          Тоон үзүүлэлт
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard label="Идэвхтэй асуулт" value={String(counts.activeQuestions)} />
          <KpiCard label="Судлагдахуун" value={String(counts.subjects)} />
          <KpiCard label="Хэрэглэгч" value={String(counts.users)} />
          <KpiCard label="7 хоногийн оролдлого" value={String(counts.attemptsLast7Days)} />
          <KpiCard label="Шийдэгдээгүй мэдээлэл" value={String(counts.openReports)} />
        </div>
      </section>

      <section aria-labelledby="review-heading" className="flex flex-col gap-3">
        <h2 id="review-heading" className="text-lg font-semibold">
          Хянах шаардлагатай асуултууд
        </h2>
        <p className="text-sm text-muted-foreground">
          Хэрэглэгч бүрийн ЭХНИЙ хариултаар тооцов (давтан дадлага тооцогдохгүй). Дор хаяж{" "}
          {REVIEW_MIN_USERS} хэрэглэгч хариулсан асуултууд, алдсан хувиар эрэмбэлэв. Алдалт өндөр
          байвал зөв хариултын түлхүүр буруу байх магадлалтай.
        </p>
        <ReviewTable rows={review} />
      </section>
    </div>
  );
}
