"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Error boundaries must be Client Components. Next 16 passes `retry`, not `reset`. */
export default function DashboardError({
  error,
  retry,
}: {
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
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold">Хяналтын самбарыг ачаалж чадсангүй</h1>
            <p className="text-sm text-muted-foreground">
              Түр зуурын алдаа гарлаа. Дахин оролдоно уу.
            </p>
          </div>
          <Button type="button" onClick={() => retry()} className="h-11 w-full sm:h-9 sm:w-auto">
            Дахин оролдох
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
