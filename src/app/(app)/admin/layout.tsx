import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await auth.protect();
  await requireAdmin();
  return children;
}
