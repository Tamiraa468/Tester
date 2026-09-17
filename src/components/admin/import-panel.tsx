"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, FileUpIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { previewImport, runImport } from "@/server/actions/admin/import";
import type { ImportPreview, ImportSummary } from "@/server/actions/admin/import";
import {
  IMPORT_MESSAGES,
  MAX_DATA_ROWS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  PREVIEW_SAMPLE_SIZE,
} from "@/server/actions/admin/import.schemas";

/**
 * Upload -> preview -> import. The file stays in the input between the two steps and is
 * posted again for the import: the server re-reads and re-validates it, so nothing that
 * comes back from this component is ever written to the bank.
 */
export function ImportPanel() {
  const router = useRouter();
  const fieldId = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, startChecking] = useTransition();
  const [importing, startImporting] = useTransition();

  const busy = checking || importing;

  const currentFile = (): File | null => fileInput.current?.files?.[0] ?? null;

  const reset = () => {
    setPreview(null);
    setSummary(null);
    setConfirmed(false);
    setError(null);
  };

  const check = () => {
    const file = currentFile();
    reset();
    if (!file) {
      setError(IMPORT_MESSAGES.noFile);
      return;
    }
    // Checked here too, so an oversized file is refused without uploading it.
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(IMPORT_MESSAGES.tooLarge);
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    startChecking(async () => {
      const result = await previewImport(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPreview(result);
    });
  };

  const start = () => {
    const file = currentFile();
    if (!file || !preview?.canImport) return;
    setError(null);

    const formData = new FormData();
    formData.set("file", file);
    if (confirmed) formData.set("confirmAnswerChanges", "1");

    startImporting(async () => {
      const result = await runImport(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      if ("needsConfirmation" in result) {
        setError(IMPORT_MESSAGES.needsConfirmation);
        return;
      }
      setSummary(result);
      setPreview(null);
      toast.success(`Импорт дууслаа: ${result.created} шинэ, ${result.updated} шинэчлэгдсэн.`);
      router.refresh();
    });
  };

  const needsConfirmation = (preview?.answerKeyChanges.length ?? 0) > 0;
  const canImport = preview?.canImport === true && (!needsConfirmation || confirmed);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Файл сонгох</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>.xlsx эсвэл .csv файл</Label>
            <Input
              id={fieldId}
              ref={fileInput}
              type="file"
              accept=".xlsx,.csv"
              disabled={busy}
              onChange={(event) => {
                setFileName(event.target.files?.[0]?.name ?? null);
                reset();
              }}
              className="h-auto py-2"
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              Дээд хэмжээ: {MAX_UPLOAD_LABEL}, {MAX_DATA_ROWS} мөр. Загвар файлыг доороос татаж
              авна уу.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={check} disabled={busy || fileName === null} className="h-9">
              <FileUpIcon aria-hidden="true" />
              {checking ? "Шалгаж байна…" : "Шалгах"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={start}
              disabled={busy || !canImport}
              className="h-9"
            >
              <UploadIcon aria-hidden="true" />
              {importing ? "Импортлож байна…" : "Импортлох"}
            </Button>
          </div>

          <p role="alert" className="text-sm text-destructive empty:hidden">
            {error}
          </p>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Урьдчилан шалгалт
              <span className="ml-2 font-mono text-sm font-normal text-muted-foreground">
                {preview.fileName}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Мөр", preview.totals.rows],
                ["Шинэ", preview.totals.toCreate],
                ["Шинэчлэх", preview.totals.toUpdate],
                ["Алдаа", preview.totals.errors],
                ["Санамж", preview.totals.warnings],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd
                    className={cn(
                      "text-xl font-semibold tabular-nums",
                      label === "Алдаа" && Number(value) > 0 && "text-destructive",
                    )}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {preview.totals.errors > 0 && (
              <p role="alert" className="text-sm text-destructive">
                {IMPORT_MESSAGES.hasErrors}
              </p>
            )}

            {needsConfirmation && (
              <div className="flex flex-col gap-2 rounded-lg border border-warning/50 bg-warning/5 p-3">
                <p className="text-sm font-medium">Зөв хариулт өөрчлөгдөж буй асуултууд</p>
                <ul className="flex flex-col gap-1">
                  {preview.answerKeyChanges.map((change) => (
                    <li key={change.code} className="text-xs text-muted-foreground tabular-nums">
                      мөр {change.rowNumber} · {change.code} — {change.affectedUsers} хэрэглэгчийн
                      давтлага тэглэгдэнэ
                    </li>
                  ))}
                </ul>
                <Label className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={confirmed}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  Ойлголоо, эдгээр хэрэглэгчийн давтлагыг тэглэхийг зөвшөөрч байна.
                </Label>
              </div>
            )}

            {preview.issues.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Анхаарах мөрүүд</p>
                <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-3">
                  {preview.issues.map((issue, index) => (
                    <li key={index} className="flex gap-2 text-xs">
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0",
                          issue.kind === "error"
                            ? "border-destructive text-destructive"
                            : "border-warning text-warning",
                        )}
                      >
                        мөр {issue.rowNumber}
                      </Badge>
                      <span className="text-muted-foreground">
                        {issue.code ? `${issue.code}: ` : ""}
                        {issue.message}
                      </span>
                    </li>
                  ))}
                </ul>
                {preview.issuesTruncated > 0 && (
                  <p className="text-xs text-muted-foreground tabular-nums">
                    …бас {preview.issuesTruncated} мэдэгдэл харуулаагүй.
                  </p>
                )}
              </div>
            )}

            {preview.sample.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium tabular-nums">
                  Эхний {Math.min(PREVIEW_SAMPLE_SIZE, preview.sample.length)} мөр
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Мөр</TableHead>
                      <TableHead>Код</TableHead>
                      <TableHead>Асуулт</TableHead>
                      <TableHead>Судлагдахуун</TableHead>
                      <TableHead className="text-right">Хувилбар</TableHead>
                      <TableHead className="text-right">Үйлдэл</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.sample.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                        <TableCell className="font-mono text-xs">{row.code}</TableCell>
                        <TableCell className="max-w-sm">
                          <span className="line-clamp-2 font-serif">{row.text}</span>
                        </TableCell>
                        <TableCell className="text-sm">{row.subjectName}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.optionCount}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.action === "create" ? "secondary" : "outline"}>
                            {row.action === "create" ? "Шинэ" : "Шинэчлэх"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card className="ring-success/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2Icon className="size-5 text-success" aria-hidden="true" />
              Импорт дууслаа
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[
                ["Шинэ", summary.created],
                ["Шинэчилсэн", summary.updated],
                ["Өөрчлөлтгүй", summary.unchanged],
                ["Анхаарах", summary.skipped],
                ["Хугацаа (мс)", summary.elapsedMs],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-xl font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {summary.answerKeyChanges.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Зөв хариулт өөрчлөгдсөн: {summary.answerKeyChanges.join(", ")}. Эдгээр асуултын
                давтлага тэглэгдлээ.
              </p>
            )}

            {summary.notes.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-lg border p-3">
                {summary.notes.map((note) => (
                  <li key={note.rowNumber} className="text-xs text-muted-foreground">
                    мөр {note.rowNumber} · {note.code}: {note.message}
                  </li>
                ))}
              </ul>
            )}

            {summary.warnings.length > 0 && (
              <ul className="flex max-h-60 flex-col gap-1 overflow-y-auto rounded-lg border p-3">
                {summary.warnings.map((issue, index) => (
                  <li key={index} className="text-xs text-muted-foreground">
                    мөр {issue.rowNumber}: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
