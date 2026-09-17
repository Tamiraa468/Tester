"use client";

import { useState, useTransition } from "react";
import { CircleCheckIcon, ClockIcon, ListChecksIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { PresetPlan } from "@/lib/quiz/exam-preset";
import { startExam } from "@/server/actions/exam";

export function PresetCard({
  id,
  name,
  questionCount,
  timeLimitMin,
  plan,
  hasOpenExam,
}: {
  id: string;
  name: string;
  questionCount: number;
  timeLimitMin: number;
  plan: PresetPlan;
  hasOpenExam: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const start = () => {
    startTransition(async () => {
      // Redirects to the exam; only returns on failure.
      const result = await startExam(id);
      if (result?.error) {
        setOpen(false);
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">{name}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 tabular-nums">
            <ListChecksIcon className="size-4" aria-hidden="true" />
            {questionCount} асуулт
          </span>
          <span className="flex items-center gap-1.5 tabular-nums">
            <ClockIcon className="size-4" aria-hidden="true" />
            {timeLimitMin} минут
          </span>
        </div>
        {plan.ok ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <CircleCheckIcon className="size-4" aria-hidden="true" />
            Эхлүүлэх боломжтой
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-sm text-destructive">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Одоогоор эхлүүлэх боломжгүй. {plan.reason}
            </span>
          </p>
        )}
      </CardContent>
      <CardFooter>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            render={<Button type="button" className="h-11 w-full text-base sm:h-9 sm:text-sm" />}
            disabled={!plan.ok}
          >
            Эхлэх
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{name}</AlertDialogTitle>
              <AlertDialogDescription>
                {questionCount} асуулт, {timeLimitMin} минут. Эхлэхээс өмнө дүрмийг уншина уу.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              <li>Хугацаа «Эхлэх» дармагц эхэлнэ. Хуудсаа хаасан ч хугацаа үргэлжлэн тоологдоно.</li>
              <li>Хугацаа дуусахад шалгалт автоматаар дуусна.</li>
              <li>Хариулт автоматаар хадгалагдана. Шалгалтаа дуусгах хүртэл хариултаа өөрчилж болно.</li>
              <li>Шалгалт дуустал зөв, буруу хариулт харагдахгүй.</li>
              <li>Дахин харах асуултаа «Эргэж харах» тэмдгээр (F товч) тэмдэглэж болно.</li>
              <li>Нэг удаад зөвхөн нэг шалгалт өгнө.</li>
            </ul>
            {hasOpenExam && (
              <p className="text-sm text-warning">
                Танд дуусаагүй шалгалт байна. «Эхлэх» дарахад тэр шалгалт үргэлжилнэ.
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Болих</AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={start}>
                {pending ? "Бэлтгэж байна…" : "Эхлэх"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
