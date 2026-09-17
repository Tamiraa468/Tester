import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ChevronLeftIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuestionActiveButton } from "@/components/admin/question-active-button";
import { QuestionForm } from "@/components/admin/question-form";
import { requireAdmin } from "@/lib/auth";
import { buildPreviewOrders } from "@/lib/quiz/preview";
import { cryptoRandomInt } from "@/lib/quiz/random";
import { getAdminQuestion, listAllSubjects } from "@/server/queries/admin/questions";

export const metadata: Metadata = { title: "Асуулт засах" };

export default async function EditQuestionPage({ params }: PageProps<"/admin/questions/[id]">) {
  await auth.protect();
  await requireAdmin();

  const { id } = await params;
  const [question, subjects] = await Promise.all([getAdminQuestion(id), listAllSubjects()]);
  if (!question) notFound();

  const initialOrders = buildPreviewOrders(question.options, question.lockOptions, cryptoRandomInt);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            <span className="font-mono text-base text-muted-foreground">{question.code}</span>
            Асуулт засах
            {!question.isActive && <Badge variant="outline">Идэвхгүй</Badge>}
          </h1>
          <QuestionActiveButton questionId={question.id} isActive={question.isActive} />
        </div>
      </div>

      <QuestionForm subjects={subjects} question={question} initialOrders={initialOrders} />
    </div>
  );
}
