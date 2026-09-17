"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBookmark } from "@/server/actions/practice";

/**
 * Optimistic bookmark toggle; rolls back and explains when the server refuses. The
 * action is told the state to store, not to flip, so a quick double click settles on
 * what the user last asked for instead of racing itself.
 */
export function useBookmark(questionId: string, initial: boolean) {
  const [bookmarked, setBookmarked] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    if (pending) return;
    const previous = bookmarked;
    const next = !previous;
    setBookmarked(next);
    startTransition(async () => {
      const result = await setBookmark({ questionId, bookmarked: next });
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
