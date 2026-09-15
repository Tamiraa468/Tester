import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Хяналтын самбар" };

export default async function DashboardPage() {
  // Layouts don't re-run on client navigation, so each page checks auth itself.
  await auth.protect();
  await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Хяналтын самбар</h1>
      <p className="text-muted-foreground">Энэ хэсэг удахгүй нэмэгдэнэ.</p>
    </div>
  );
}
