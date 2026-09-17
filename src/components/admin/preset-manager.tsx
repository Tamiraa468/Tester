"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import { PresetForm } from "@/components/admin/preset-form";
import { deletePreset, setPresetActive } from "@/server/actions/admin/presets";
import type { AdminPreset, AdminPresetsData } from "@/server/queries/admin/presets";

export function PresetManager({ presets, bank }: AdminPresetsData) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState<AdminPreset | null>(null);
  const [pending, startTransition] = useTransition();

  const done = () => {
    setEditing(null);
    setCreating(false);
    toast.success("Хадгаллаа.");
    router.refresh();
  };

  const toggleActive = (preset: AdminPreset) => {
    if (pending) return;
    startTransition(async () => {
      const result = await setPresetActive({ presetId: preset.id, isActive: !preset.isActive });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.isActive ? "Идэвхжүүллээ." : "Идэвхгүй болголоо.");
      router.refresh();
    });
  };

  const remove = (preset: AdminPreset) => {
    startTransition(async () => {
      const result = await deletePreset({ presetId: preset.id });
      setConfirming(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Устгалаа.");
      router.refresh();
    });
  };

  const subjectName = (subjectId: string) =>
    bank.bySubject.find((subject) => subject.id === subjectId)?.name ?? subjectId;

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <PresetForm preset={null} bank={bank} onDone={done} onCancel={() => setCreating(false)} />
      ) : (
        <Button
          type="button"
          className="h-9 w-fit"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          <PlusIcon aria-hidden="true" />
          Шинэ төрөл
        </Button>
      )}

      {presets.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">Одоогоор шалгалтын төрөл алга.</p>
      )}

      <ul className="flex flex-col gap-3">
        {presets.map((preset) => (
          <li key={preset.id}>
            <Card size="sm" className={cn(!preset.isActive && "opacity-70")}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{preset.name}</span>
                      {preset.isActive ? (
                        <Badge variant="secondary">Идэвхтэй</Badge>
                      ) : (
                        <Badge variant="outline">Идэвхгүй</Badge>
                      )}
                      {!preset.offeredInProduction && (
                        <Badge variant="outline">Зөвхөн хөгжүүлэлтэд</Badge>
                      )}
                      {!preset.plan.ok && (
                        <Badge variant="outline" className="border-destructive text-destructive">
                          Сан хүрэлцэхгүй
                        </Badge>
                      )}
                    </span>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {preset.questionCount} асуулт · {preset.timeLimitMin} мин ·{" "}
                      {preset.attemptCount} оролдлого
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {preset.distribution
                        ? Object.entries(preset.distribution)
                            .map(([id, count]) => `${subjectName(id)}: ${count}`)
                            .join(" · ")
                        : `Бүх сангаас санамсаргүйгээр (${bank.total} асуулт)`}
                    </p>
                    {!preset.plan.ok && (
                      <p className="text-xs text-destructive">{preset.plan.reason}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => {
                        setCreating(false);
                        setEditing(editing === preset.id ? null : preset.id);
                      }}
                    >
                      <PencilIcon aria-hidden="true" />
                      Засах
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8"
                      onClick={() => toggleActive(preset)}
                      disabled={pending}
                    >
                      {preset.isActive ? (
                        <EyeOffIcon aria-hidden="true" />
                      ) : (
                        <EyeIcon aria-hidden="true" />
                      )}
                      {preset.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`${preset.name}-г устгах`}
                      onClick={() => setConfirming(preset)}
                      disabled={pending || preset.attemptCount > 0}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                {preset.attemptCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Энэ төрлөөр шалгалт өгсөн тул устгах боломжгүй — шалгалтын түүхэд нэр нь
                    харагдана. Оронд нь идэвхгүй болгоно уу.
                  </p>
                )}

                {editing === preset.id && (
                  <PresetForm
                    preset={preset}
                    bank={bank}
                    onDone={done}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Шалгалтын төрлийг устгах уу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{confirming?.name}» устгагдана. Энэ үйлдлийг буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Болих</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => confirming && remove(confirming)}>
              {pending ? "Устгаж байна…" : "Устгах"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
