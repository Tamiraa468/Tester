"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkXIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setBookmark } from "@/server/actions/practice";

/**
 * Takes a question off the "Тэмдэглэсэн" list. setBookmark states the target instead
 * of flipping, so a double click cannot bookmark the question again; the row is also
 * hidden at once and the list refreshed, so the count and the page agree afterwards.
 */
export function RemoveBookmarkButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    if (pending || removed) return;
    startTransition(async () => {
      const result = await setBookmark({ questionId, bookmarked: false });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setRemoved(true);
      toast.success("Тэмдэглэгээг хаслаа.");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={remove}
      disabled={pending || removed}
      className="h-9 shrink-0"
    >
      <BookmarkXIcon aria-hidden="true" />
      Хасах
    </Button>
  );
}
