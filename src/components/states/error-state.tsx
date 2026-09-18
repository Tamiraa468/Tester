"use client";

import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { mn } from "@/lib/i18n/mn";

/**
 * The body of every error.tsx boundary. Error boundaries must be Client Components,
 * and Next 16 passes `retry`, not `reset`.
 *
 * `error.digest` is the only safe thing to show: the message of a server error is
 * redacted in production, and showing it in development only would make the two
 * environments disagree about what the user sees.
 */
export function ErrorState({
  title = mn.states.errorTitle,
  error,
  retry,
}: {
  title?: string;
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardContent className="flex flex-col items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlertIcon className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">{title}</h1>
            <p className="text-sm text-muted-foreground">{mn.states.errorBody}</p>
          </div>
          <Button type="button" onClick={() => retry()} className="h-11 w-full sm:h-9 sm:w-auto">
            {mn.actions.retry}
          </Button>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground">
              <span className="sr-only">Алдааны дугаар: </span>
              {error.digest}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
