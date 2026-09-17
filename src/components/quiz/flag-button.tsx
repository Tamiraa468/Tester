"use client";

import { FlagIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

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
      className={cn(flagged && "text-warning", className)}
    >
      <FlagIcon className={cn(flagged && "fill-current")} aria-hidden="true" />
      Эргэж харах
    </Button>
  );
}
