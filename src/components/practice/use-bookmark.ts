"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleBookmark } from "@/server/actions/practice";

/** Optimistic bookmark toggle; rolls back and explains when the server refuses. */
export function useBookmark(questionId: string, initial: boolean) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (pending) return;
    const previous = bookmarked;
    setBookmarked(!previous);
    startTransition(async () => {
      const result = await toggleBookmark(questionId);
      if ("error" in result) {
        setBookmarked(previous);
        toast.error(result.error);
        return;
      }
      setBookmarked(result.bookmarked);
    });
  };

  return { bookmarked, pending, toggle };
}
