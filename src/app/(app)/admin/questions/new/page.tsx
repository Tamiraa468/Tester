import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ChevronLeftIcon } from "lucide-react";
import { NEW_QUESTION_ROWS, QuestionForm } from "@/components/admin/question-form";
import { requireAdmin } from "@/lib/auth";
import { buildPreviewOrders } from "@/lib/quiz/preview";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { listAllSubjects } from "@/server/queries/admin/questions";

export const metadata: Metadata = { title: "Шинэ асуулт" };

export default async function NewQuestionPage() {
  await auth.protect();
  await requireAdmin();

  const subjects = await listAllSubjects();
  // The first shuffle is rendered on the server, so the preview panel is never empty
  // and the browser never shuffles anything itself.
  const initialOrders = buildPreviewOrders(
    Array.from({ length: NEW_QUESTION_ROWS }, (_, index) => ({
      isCorrect: index === 0,
      pinned: false,
    })),
    false,
    cryptoRandomInt,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/admin/questions"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeftIcon className="size-4" aria-hidden="true" />
          Асуултууд
        </Link>
        <h1 className="text-2xl font-semibold">Шинэ асуулт</h1>
      </div>

      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Эхлээд судлагдахуун үүсгэнэ үү.
        </p>
      ) : (
        <QuestionForm subjects={subjects} question={null} initialOrders={initialOrders} />
      )}
    </div>
  );
}
