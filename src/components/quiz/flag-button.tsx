"use client";

import { FlagIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { mn } from "@/lib/i18n/mn";

/**
 * Marks an exam question to come back to (AttemptItem.flagged). The label stays the
 * same in both states; aria-pressed carries the state, and the navigator shows it.
 */
export function FlagButton({
  flagged,
  onToggle,
  disabled,
  className,
}: {
  flagged: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant={flagged ? "secondary" : "ghost"}
      size="sm"
      aria-pressed={flagged}
      onClick={onToggle}
      disabled={disabled}
      // 44px on touch, back to the compact card action from sm up.
      className={cn("h-11 px-3 sm:h-7 sm:px-2.5", flagged && "text-warning", className)}
    >
      <FlagIcon className={cn(flagged && "fill-current")} aria-hidden="true" />
      {mn.quiz.flag}
    </Button>
  );
}
