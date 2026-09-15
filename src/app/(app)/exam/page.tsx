import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Шалгалт" };

export default async function ExamPage() {
  await auth.protect();
  await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Шалгалт</h1>
      <p className="text-muted-foreground">Энэ хэсэг удахгүй нэмэгдэнэ.</p>
    </div>
  );
}
