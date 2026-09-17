"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createSubject, deleteSubject, updateSubject } from "@/server/actions/admin/subjects";
import type { AdminSubject } from "@/server/queries/admin/subjects";

type Draft = { name: string; sortOrder: string };

export function SubjectManager({ subjects }: { subjects: readonly AdminSubject[] }) {
  const router = useRouter();
  const fieldId = useId();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newSubject, setNewSubject] = useState<Draft>({ name: "", sortOrder: "" });
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminSubject | null>(null);
  const [pending, startTransition] = useTransition();

  const draftFor = (subject: AdminSubject): Draft =>
    drafts[subject.id] ?? { name: subject.name, sortOrder: String(subject.sortOrder) };

  const setDraft = (subject: AdminSubject, patch: Partial<Draft>) =>
    setDrafts({ ...drafts, [subject.id]: { ...draftFor(subject), ...patch } });

  const create = () => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await createSubject({
        name: newSubject.name,
        sortOrder: Number(newSubject.sortOrder || 0),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNewSubject({ name: "", sortOrder: "" });
      toast.success("Судлагдахуун нэмэгдлээ.");
      router.refresh();
    });
  };

  const save = (subject: AdminSubject) => {
    if (pending) return;
    setError(null);
    const draft = draftFor(subject);
    startTransition(async () => {
      const result = await updateSubject({
        subjectId: subject.id,
        name: draft.name,
        sortOrder: Number(draft.sortOrder || 0),
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setDrafts(Object.fromEntries(Object.entries(drafts).filter(([id]) => id !== subject.id)));
      toast.success("Хадгаллаа.");
      router.refresh();
    });
  };

  const remove = (subject: AdminSubject) => {
    startTransition(async () => {
      const result = await deleteSubject({ subjectId: subject.id });
      if ("error" in result) {
        setConfirming(null);
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setConfirming(null);
      toast.success("Устгалаа.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Шинэ судлагдахуун</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              create();
            }}
          >
            <div className="flex min-w-60 flex-1 flex-col gap-2">
              <Label htmlFor={`${fieldId}-name`}>Нэр</Label>
              <Input
                id={`${fieldId}-name`}
                value={newSubject.name}
                onChange={(event) => setNewSubject({ ...newSubject, name: event.target.value })}
                className="h-9"
                required
              />
            </div>
            <div className="flex w-28 flex-col gap-2">
              <Label htmlFor={`${fieldId}-order`}>Эрэмбэ</Label>
              <Input
                id={`${fieldId}-order`}
                type="number"
                min={0}
                value={newSubject.sortOrder}
                onChange={(event) =>
                  setNewSubject({ ...newSubject, sortOrder: event.target.value })
                }
                className="h-9 tabular-nums"
                placeholder="0"
              />
            </div>
            <Button type="submit" disabled={pending} className="h-9">
              <PlusIcon aria-hidden="true" />
              Нэмэх
            </Button>
          </form>
        </CardContent>
      </Card>

      <p role="alert" className="text-sm text-destructive empty:hidden">
        {error}
      </p>

      {subjects.length === 0 ? (
        <p className="text-sm text-muted-foreground">Одоогоор судлагдахуун алга.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Эрэмбэ</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Слаг</TableHead>
              <TableHead className="text-right">Асуулт</TableHead>
              <TableHead className="text-right">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subjects.map((subject) => {
              const draft = draftFor(subject);
              const dirty =
                draft.name !== subject.name || Number(draft.sortOrder || 0) !== subject.sortOrder;
              return (
                <TableRow key={subject.id}>
                  <TableCell className="align-top">
                    <Input
                      type="number"
                      min={0}
                      value={draft.sortOrder}
                      onChange={(event) => setDraft(subject, { sortOrder: event.target.value })}
                      aria-label={`${subject.name}: эрэмбэ`}
                      className="h-9 w-20 tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft(subject, { name: event.target.value })}
                      aria-label={`${subject.name}: нэр`}
                      className="h-9 min-w-48"
                    />
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="font-mono text-xs text-muted-foreground">{subject.slug}</span>
                  </TableCell>
                  <TableCell className="align-top text-right tabular-nums">
                    <Link
                      href={`/admin/questions?subject=${subject.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {subject.questionCount}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {subject.activeQuestionCount} идэвхтэй
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => save(subject)}
                        disabled={pending || !dirty}
                      >
                        <SaveIcon aria-hidden="true" />
                        Хадгалах
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`${subject.name}-г устгах`}
                        onClick={() => setConfirming(subject)}
                        disabled={pending || subject.questionCount > 0}
                      >
                        <Trash2Icon aria-hidden="true" />
                      </Button>
                    </span>
                    {subject.questionCount > 0 && (
                      <Badge variant="outline" className="mt-1 float-right">
                        Асуулттай тул устгах боломжгүй
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Судлагдахууныг устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{confirming?.name}» устгагдана. Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Болих</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => confirming && remove(confirming)}
            >
              {pending ? "Устгаж байна…" : "Устгах"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
