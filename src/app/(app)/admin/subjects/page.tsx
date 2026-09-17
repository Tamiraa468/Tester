import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { InfoIcon } from "lucide-react";
import { SubjectManager } from "@/components/admin/subject-manager";
import { requireAdmin } from "@/lib/auth";
import { listAdminSubjects } from "@/server/queries/admin/subjects";

export const metadata: Metadata = { title: "Судлагдахуун" };

export default async function AdminSubjectsPage() {
  await auth.protect();
  await requireAdmin();

  const subjects = await listAdminSubjects();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Судлагдахуун</h1>
        <p className="text-sm text-muted-foreground">
          Нэр, эрэмбийг засах. Асуулттай судлагдахууныг устгах боломжгүй.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          Импорт нь судлагдахууныг <strong>нэрээр нь</strong> тааруулдаг. Нэрийг өөрчилсний дараа
          хуучин нэртэй файл импортловол шинэ судлагдахуун үүснэ. Слаг нь хэвээр үлдэнэ.
        </span>
      </p>

      <SubjectManager subjects={subjects} />
    </div>
  );
}
