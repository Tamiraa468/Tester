"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function FinishExamDialog({
  open,
  onOpenChange,
  unanswered,
  flagged,
  unsaved,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unanswered: number;
  flagged: number;
  unsaved: number;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Шалгалтаа дуусгах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            Дуусгасны дараа хариултаа өөрчлөх боломжгүй.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">Хариулаагүй</dt>
            <dd className="text-lg font-semibold tabular-nums">{unanswered}</dd>
          </div>
          <div className="rounded-lg bg-warning/10 p-2">
            <dt className="text-xs text-muted-foreground">Эргэж харах</dt>
            <dd className="text-lg font-semibold tabular-nums">{flagged}</dd>
          </div>
        </dl>
        {unsaved > 0 && (
          <p role="alert" className="text-sm text-destructive">
            {unsaved} хариулт хадгалагдаагүй байна. Дуусгахаас өмнө дахин хадгалахыг оролдоно.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Үргэлжлүүлэх</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={onConfirm}>
            {pending ? "Дуусгаж байна…" : "Дуусгах"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
