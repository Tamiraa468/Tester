import { auth } from "@clerk/nextjs/server";
import { AdminNav, type AdminNavLink } from "@/components/admin/admin-nav";
import { ReportStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();
  await requireAdmin();

  const openReports = await db.questionReport.count({ where: { status: ReportStatus.OPEN } });
  const links: AdminNavLink[] = [
    { href: "/admin", label: "Тойм" },
    { href: "/admin/questions", label: "Асуултууд" },
    { href: "/admin/reports", label: "Ирсэн мэдээлэл", badge: openReports },
  ];

  return (
    <div className="flex flex-col gap-6">
      <AdminNav links={links} />
      {children}
    </div>
  );
}
