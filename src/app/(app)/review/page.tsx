import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Давтах" };

export default async function ReviewPage() {
  await auth.protect();
  await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Давтах</h1>
      <p className="text-muted-foreground">Энэ хэсэг удахгүй нэмэгдэнэ.</p>
    </div>
  );
}
