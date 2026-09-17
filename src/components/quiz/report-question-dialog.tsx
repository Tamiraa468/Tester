"use client";

import { useId, useState, useTransition } from "react";
import { MessageSquareWarningIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const MIN = 5;
const MAX = 1000;

/** "Алдаа мэдээлэх": the server validates again; this only saves a round trip. */
export function ReportQuestionDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (message: string) => Promise<{ error: string } | { ok: true }>;
}) {
  const fieldId = useId();
  const errorId = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const length = message.trim().length;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (length < MIN || pending) return;
    startTransition(async () => {
      const result = await onSubmit(message);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMessage("");
      setError(null);
      onOpenChange(false);
      toast.success("Мэдээлэл илгээгдлээ. Баярлалаа!");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <MessageSquareWarningIcon aria-hidden="true" />
        Алдаа мэдээлэх
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Алдаа мэдээлэх</DialogTitle>
            <DialogDescription>
              Асуулт, хариулт эсвэл тайлбарт алдаа байвал бидэнд мэдэгдээрэй.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>Юу буруу байна вэ?</Label>
            <Textarea
              id={fieldId}
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError(null);
              }}
              maxLength={MAX}
              rows={4}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            <div className="flex items-start justify-between gap-2 text-xs">
              <p id={errorId} role="alert" className="text-destructive">
                {error}
              </p>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {message.length} / {MAX}
              </span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Болих</DialogClose>
            <Button type="submit" disabled={length < MIN || pending}>
              {pending ? "Илгээж байна…" : "Илгээх"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
