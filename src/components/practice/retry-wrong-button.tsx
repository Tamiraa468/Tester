"use client";

import { useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttemptSource } from "@/generated/prisma/enums";
import { mn } from "@/lib/i18n/mn";
import { createPracticeAttempt } from "@/server/actions/practice";

/** Starts a CUSTOM practice from this attempt's wrong answers (chosen on the server). */
export function RetryWrongButton({
  attemptId,
  count,
  label = mn.actions.retryWrong,
}: {
  attemptId: string;
  count: number;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="lg"
      className="h-11 w-full text-base sm:w-auto"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Only returns on failure; on success the action redirects.
          const result = await createPracticeAttempt({
            source: AttemptSource.CUSTOM,
            fromAttemptId: attemptId,
          });
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <RotateCcwIcon aria-hidden="true" />
      {pending ? mn.actions.preparing : `${label} (${count})`}
    </Button>
  );
}
