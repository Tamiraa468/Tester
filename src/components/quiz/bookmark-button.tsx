"use client";

import { BookmarkIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

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
      className={className}
    >
      <BookmarkIcon className={cn(bookmarked && "fill-current")} aria-hidden="true" />
      {bookmarked ? "Тэмдэглэсэн" : "Тэмдэглэх"}
    </Button>
  );
}
