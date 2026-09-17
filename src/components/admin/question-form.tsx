"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { OptionPreview } from "@/components/admin/option-preview";
import { OPTION_MAX, OPTION_MIN, questionWarnings } from "@/lib/import/question-schema";
import { createQuestion, previewOptionOrders, updateQuestion } from "@/server/actions/admin/questions";
import type { AdminQuestion } from "@/server/queries/admin/questions";

type Row = {
  /** Stable React key; an option id once the row exists in the database. */
  key: string;
  optionId: string | null;
  text: string;
  isCorrect: boolean;
  pinned: boolean;
};

export type QuestionFormProps = {
  subjects: { id: string; name: string }[];
  /** null: a new question. */
  question: AdminQuestion | null;
  /** First set of shuffles, computed on the server so the panel is never empty. */
  initialOrders: number[][];
};

/** Two empty rows, the first one correct — the shape /admin/questions/new starts from. */
export const NEW_QUESTION_ROWS = 2;

function initialRows(question: AdminQuestion | null): Row[] {
  if (question) {
    return question.options.map((option) => ({
      key: option.id,
      optionId: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      pinned: option.pinned,
    }));
  }
  return Array.from({ length: NEW_QUESTION_ROWS }, (_, index) => ({
    key: `new-${index}`,
    optionId: null,
    text: "",
    isCorrect: index === 0,
    pinned: false,
  }));
}

export function QuestionForm({ subjects, question, initialOrders }: QuestionFormProps) {
  const router = useRouter();
  const fieldId = useId();
  const nextKey = useRef(0);

  const [code, setCode] = useState(question?.code ?? "");
  const [subjectId, setSubjectId] = useState(question?.subjectId ?? subjects[0]?.id ?? "");
  const [text, setText] = useState(question?.text ?? "");
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [lockOptions, setLockOptions] = useState(question?.lockOptions ?? false);
  const [rows, setRows] = useState<Row[]>(() => initialRows(question));

  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ affectedUsers: number } | null>(null);
  const [saving, startSaving] = useTransition();

  const [orders, setOrders] = useState<number[][]>(initialOrders);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const latestPreview = useRef(0);

  const locked = (question?.attemptCount ?? 0) > 0;
  const subjectName = subjects.find((subject) => subject.id === subjectId)?.name;
  const warnings = questionWarnings({ text, subjectName, lockOptions, options: rows });

  /**
   * Asks the server for a fresh set of shuffles. Called from the handlers that change
   * the draft's shape (and from the button), never from an effect.
   */
  const requestPreview = (nextRows: readonly Row[], nextLock: boolean) => {
    const request = latestPreview.current + 1;
    latestPreview.current = request;
    setPreviewPending(true);
    void previewOptionOrders({
      lockOptions: nextLock,
      options: nextRows.map((row) => ({
        text: row.text,
        isCorrect: row.isCorrect,
        pinned: row.pinned,
      })),
    }).then((result) => {
      // An older request that lands late must not overwrite a newer answer.
      if (latestPreview.current !== request) return;
      setPreviewPending(false);
      if ("error" in result) {
        setPreviewError(result.error);
        return;
      }
      setPreviewError(null);
      setOrders(result.orders);
    });
  };

  /** Every shape change goes through here, so the preview and the rows stay in step. */
  const changeRows = (next: Row[]) => {
    setRows(next);
    requestPreview(next, lockOptions);
  };

  const editText = (index: number, value: string) => {
    // Text does not change the layout, so no new shuffle is requested.
    setRows(rows.map((row, at) => (at === index ? { ...row, text: value } : row)));
  };

  const setCorrect = (index: number) =>
    changeRows(rows.map((row, at) => ({ ...row, isCorrect: at === index })));

  const setPinned = (index: number, pinned: boolean) =>
    changeRows(rows.map((row, at) => (at === index ? { ...row, pinned } : row)));

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    [next[index], next[to]] = [next[to], next[index]];
    changeRows(next);
  };

  const addRow = () => {
    if (rows.length >= OPTION_MAX) return;
    nextKey.current += 1;
    changeRows([
      ...rows,
      { key: `draft-${nextKey.current}`, optionId: null, text: "", isCorrect: false, pinned: false },
    ]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= OPTION_MIN || locked) return;
    const next = rows.filter((_, at) => at !== index);
    // The correct option may have just been removed; the first row inherits it.
    if (!next.some((row) => row.isCorrect)) next[0] = { ...next[0], isCorrect: true };
    changeRows(next);
  };

  const toggleLock = (value: boolean) => {
    setLockOptions(value);
    requestPreview(rows, value);
  };

  const body = () => ({
    subjectId,
    text,
    imageUrl,
    explanation,
    lockOptions,
    options: rows.map((row) => ({
      optionId: row.optionId,
      text: row.text,
      isCorrect: row.isCorrect,
      pinned: row.pinned,
    })),
  });

  const save = (confirmAnswerChange = false) => {
    if (saving) return;
    setError(null);
    startSaving(async () => {
      if (!question) {
        const result = await createQuestion({ code, ...body() });
        if ("error" in result) {
          setError(result.error);
          return;
        }
        toast.success("Асуулт үүслээ.");
        router.push(`/admin/questions/${result.questionId}`);
        return;
      }

      const result = await updateQuestion({
        questionId: question.id,
        ...body(),
        confirmAnswerChange,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("needsConfirmation" in result) {
        setConfirming(result.needsConfirmation);
        return;
      }
      setConfirming(null);
      toast.success(
        result.resetUsers > 0
          ? `Хадгаллаа. ${result.resetUsers} хэрэглэгчийн давтлага тэглэгдлээ.`
          : "Хадгаллаа.",
      );
      router.refresh();
    });
  };

  const subjectItems = Object.fromEntries(subjects.map((subject) => [subject.id, subject.name]));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Асуулт</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-code`}>Код</Label>
              <Input
                id={`${fieldId}-code`}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                readOnly={question !== null}
                aria-describedby={question ? `${fieldId}-code-hint` : undefined}
                className={cn("h-9 font-mono", question && "bg-muted text-muted-foreground")}
                required
              />
              {question && (
                <p id={`${fieldId}-code-hint`} className="text-xs text-muted-foreground">
                  Импорт асуултыг кодоор нь тааруулдаг тул кодыг үүсгэсний дараа өөрчилж болохгүй.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`${fieldId}-subject`}>Судлагдахуун</Label>
              <Select
                items={subjectItems}
                value={subjectId}
                onValueChange={(value) => setSubjectId(value as string)}
              >
                <SelectTrigger id={`${fieldId}-subject`} className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-text`}>Асуултын текст</Label>
            <Textarea
              id={`${fieldId}-text`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={3}
              className="font-serif"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-image`}>Зургийн хаяг (сонголттой)</Label>
            <Input
              id={`${fieldId}-image`}
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`${fieldId}-explanation`}>Тайлбар (сонголттой)</Label>
            <Textarea
              id={`${fieldId}-explanation`}
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
              className="font-serif"
            />
          </div>

          <Label className="flex items-start gap-3 rounded-lg border p-3 font-normal">
            <Switch checked={lockOptions} onCheckedChange={toggleLock} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Дарааллыг түгжих</span>
              <span className="text-xs text-muted-foreground">
                Хувилбарууд бие биеэ үсгээр иш татсан бол («a ба b зөв») хольж болохгүй.
              </span>
            </span>
          </Label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Хувилбарууд</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={addRow}
            disabled={rows.length >= OPTION_MAX}
          >
            <PlusIcon aria-hidden="true" />
            Хувилбар нэмэх
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {locked && (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              Энэ асуултад {question?.attemptCount} хариулт бүртгэгдсэн тул хувилбарыг устгах
              боломжгүй. Асуултыг бүрмөсөн хасах бол идэвхгүй болгоно уу.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <li key={row.key} className="flex flex-wrap items-start gap-2 rounded-lg border p-3">
                <span className="flex w-full items-center gap-3 sm:w-auto sm:flex-col sm:gap-1">
                  <span className="text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <span className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`${index + 1}-р хувилбарыг дээш зөөх`}
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUpIcon aria-hidden="true" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`${index + 1}-р хувилбарыг доош зөөх`}
                      onClick={() => move(index, 1)}
                      disabled={index === rows.length - 1}
                    >
                      <ArrowDownIcon aria-hidden="true" />
                    </Button>
                  </span>
                </span>

                <Input
                  value={row.text}
                  onChange={(event) => editText(index, event.target.value)}
                  aria-label={`${index + 1}-р хувилбарын текст`}
                  className="h-9 min-w-48 flex-1 font-serif"
                  required
                />

                <span className="flex items-center gap-4">
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <input
                      type="radio"
                      name={`${fieldId}-correct`}
                      checked={row.isCorrect}
                      onChange={() => setCorrect(index)}
                      className="size-4 accent-primary"
                    />
                    Зөв
                  </Label>
                  <Label className="flex items-center gap-2 text-sm font-normal">
                    <Checkbox
                      checked={row.pinned}
                      onCheckedChange={(checked) => setPinned(index, checked === true)}
                    />
                    Төгсгөлд тогтмол
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`${index + 1}-р хувилбарыг устгах`}
                    onClick={() => removeRow(index)}
                    disabled={locked || rows.length <= OPTION_MIN}
                  >
                    <Trash2Icon aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>

          {warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-warning/40 bg-warning/5 p-3">
              {warnings.map((warning) => (
                <li key={warning} className="text-xs text-muted-foreground">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Урьдчилан харах
            {question && <Badge variant="secondary" className="ml-2">{question.attemptCount} хариулт</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OptionPreview
            options={rows}
            orders={orders}
            lockOptions={lockOptions}
            pending={previewPending}
            error={previewError}
            onReshuffle={() => requestPreview(rows, lockOptions)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm text-destructive empty:hidden">
          {error}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving} className="h-10">
            <SaveIcon aria-hidden="true" />
            {saving ? "Хадгалж байна…" : question ? "Хадгалах" : "Үүсгэх"}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Зөв хариултыг өөрчлөх үү?</AlertDialogTitle>
            <AlertDialogDescription>
              Энэ асуултын зөв хариулт солигдож байна. {confirming?.affectedUsers ?? 0} хэрэглэгчийн
              энэ асуулт дахь давтлага тэглэгдэж, дахин давтах жагсаалтад орно. Өмнөх оролдлогуудын
              дүн хэвээр үлдэнэ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Болих</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => save(true)}>
              {saving ? "Хадгалж байна…" : "Тийм, өөрчлөх"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
