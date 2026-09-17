"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key } from "@/components/quiz/keyboard-hints";

function Row({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <dt className="text-sm">{children}</dt>
      <dd className="flex shrink-0 items-center gap-1">{keys}</dd>
    </div>
  );
}

export function KeyboardHelpDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "practice" | "exam";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Товчлуурын товчлол</DialogTitle>
          <DialogDescription>
            Монгол болон англи гарын байрлалд адилхан ажиллана.
          </DialogDescription>
        </DialogHeader>
        <dl className="divide-y">
          <Row keys={<><Key>1</Key>–<Key>6</Key></>}>
            {mode === "exam" ? "Хариулт сонгох эсвэл солих" : "Тухайн хариултыг сонгох"}
          </Row>
          <Row keys={<><Key>↑</Key><Key>↓</Key></>}>Хариултуудын хооронд шилжих</Row>
          <Row keys={<><Key>Enter</Key><Key>Space</Key></>}>Идэвхтэй хариултыг сонгох</Row>
          {mode === "practice" && (
            <Row keys={<Key>Enter</Key>}>Хариулсны дараа: дараагийн асуулт</Row>
          )}
          {mode === "exam" && (
            <>
              <Row keys={<Key>N</Key>}>Дараагийн асуулт</Row>
              <Row keys={<Key>P</Key>}>Өмнөх асуулт</Row>
              <Row keys={<Key>F</Key>}>Эргэж харах тэмдэг тавих / авах</Row>
            </>
          )}
          <Row keys={<Key>?</Key>}>Энэ тусламжийг нээх</Row>
          <Row keys={<Key>Esc</Key>}>Цонхыг хаах</Row>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
