import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Админ" };

export default async function AdminPage() {
  // Layouts don't re-run on client navigation, so the page checks the role too.
  await auth.protect();
  await requireAdmin();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Админ</h1>
      <p className="text-muted-foreground">Энэ хэсэг удахгүй нэмэгдэнэ.</p>
    </div>
  );
}
