"use client";

import { BookmarkIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

/**
 * Bookmarks a question (Bookmark in the schema): practice mode and the /review page.
 * Not to be confused with the exam's "Эргэж харах" flag, which lives on AttemptItem.
 */
export function BookmarkButton({
  bookmarked,
  onToggle,
  disabled,
  className,
}: {
  bookmarked: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={bookmarked ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={bookmarked}
      onClick={onToggle}
      disabled={disabled}
      // 44px on touch, back to the compact card action from sm up.
      className={cn("h-11 px-3 sm:h-7 sm:px-2.5", className)}
    >
      <BookmarkIcon className={cn(bookmarked && "fill-current")} aria-hidden="true" />
      {bookmarked ? mn.quiz.bookmarked : mn.quiz.bookmark}
    </Button>
  );
}
