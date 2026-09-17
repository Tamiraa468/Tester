import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { PlusIcon } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QuestionActiveButton } from "@/components/admin/question-active-button";
import { QuestionFilterBar } from "@/components/admin/question-filter-bar";
import { requireAdmin } from "@/lib/auth";
import { parseQuestionFilters, questionFiltersToSearch } from "@/server/queries/admin/question-filters";
import { listAdminQuestions, listAllSubjects } from "@/server/queries/admin/questions";

export const metadata: Metadata = { title: "Асуултууд" };

export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questions">) {
  await auth.protect();
  await requireAdmin();

  const filters = parseQuestionFilters(await searchParams);
  const [questions, subjects] = await Promise.all([
    listAdminQuestions(filters),
    listAllSubjects(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Асуултууд</h1>
          <p className="text-sm text-muted-foreground">Асуултын санг хайх, засах, идэвхжүүлэх.</p>
        </div>
        <Link href="/admin/questions/new" className={cn(buttonVariants(), "h-9")}>
          <PlusIcon aria-hidden="true" />
          Шинэ асуулт
        </Link>
      </div>

      <QuestionFilterBar filters={filters} subjects={subjects} total={questions.total} />

      {questions.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Тохирох асуулт олдсонгүй.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Асуулт</TableHead>
              <TableHead>Судлагдахуун</TableHead>
              <TableHead className="text-right">Хувилбар</TableHead>
              <TableHead className="text-right">Хариулт</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questions.items.map((question) => (
              <TableRow key={question.id} className={cn(!question.isActive && "opacity-60")}>
                <TableCell className="align-top font-mono text-xs">{question.code}</TableCell>
                <TableCell className="max-w-md align-top">
                  <Link
                    href={`/admin/questions/${question.id}`}
                    className="line-clamp-2 font-serif underline-offset-4 hover:underline"
                  >
                    {question.text}
                  </Link>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {!question.isActive && <Badge variant="outline">Идэвхгүй</Badge>}
                    {!question.hasExplanation && <Badge variant="outline">Тайлбаргүй</Badge>}
                    {question.pinnedCount > 0 && <Badge variant="outline">Тогтмол</Badge>}
                    {question.lockOptions && <Badge variant="outline">Түгжээтэй</Badge>}
                  </span>
                </TableCell>
                <TableCell className="align-top text-sm">{question.subjectName}</TableCell>
                <TableCell className="align-top text-right tabular-nums">
                  {question.optionCount}
                </TableCell>
                <TableCell className="align-top text-right tabular-nums">
                  {question.answerCount}
                </TableCell>
                <TableCell className="align-top">
                  <span className="flex flex-wrap items-center justify-end gap-1">
                    <Link
                      href={`/admin/questions/${question.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                    >
                      Засах
                    </Link>
                    <QuestionActiveButton questionId={question.id} isActive={question.isActive} />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {questions.pageCount > 1 && (
        <nav aria-label="Хуудаслалт" className="flex items-center justify-between gap-3">
          <Link
            href={questionFiltersToSearch(filters, { page: questions.page - 1 })}
            aria-disabled={questions.page === 1 || undefined}
            tabIndex={questions.page === 1 ? -1 : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9",
              questions.page === 1 && "pointer-events-none opacity-50",
            )}
          >
            Өмнөх
          </Link>
          <p className="text-xs text-muted-foreground tabular-nums">
            {questions.page} / {questions.pageCount} хуудас · нийт {questions.total}
          </p>
          <Link
            href={questionFiltersToSearch(filters, { page: questions.page + 1 })}
            aria-disabled={questions.page === questions.pageCount || undefined}
            tabIndex={questions.page === questions.pageCount ? -1 : undefined}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-9",
              questions.page === questions.pageCount && "pointer-events-none opacity-50",
            )}
          >
            Дараах
          </Link>
        </nav>
      )}
    </div>
  );
}
