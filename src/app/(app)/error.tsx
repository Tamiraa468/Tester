"use client";

import { ErrorState } from "@/components/states/error-state";

/** Catches anything under /(app) that has no closer boundary of its own. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState error={error} retry={retry} />;
}
