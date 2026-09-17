"use client";

import { useId, useTransition } from "react";
import { PlayIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPracticeAttempt } from "@/server/actions/practice";
import { practiceCountFor, type CountedSource } from "@/server/queries/question-sources";

/**
 * One-tap start from the dashboard or a /review tab: no setup screen, the size comes
 * from what is available (capped at 20 by practiceCountFor). The action redirects on
 * success, so only a failure ever returns here.
 */
export function StartPracticeButton({
  source,
  available,
  children,
  ...button
}: {
  source: CountedSource;
  available: number;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "onClick" | "disabled" | "type">) {
  const errorId = useId();
  const [starting, startStarting] = useTransition();

  const start = () => {
    if (starting || available === 0) return;
    startStarting(async () => {
      const result = await createPracticeAttempt({
        source,
        count: practiceCountFor(available),
        subjectId: null,
      });
      if (result?.error) toast.error(result.error, { id: errorId });
    });
  };

  return (
    <Button type="button" onClick={start} disabled={starting || available === 0} {...button}>
      <PlayIcon aria-hidden="true" />
      {starting ? "Бэлтгэж байна…" : children}
    </Button>
  );
}
