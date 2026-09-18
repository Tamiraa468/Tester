"use client";

import { ErrorState } from "@/components/states/error-state";
import { mn } from "@/lib/i18n/mn";

export default function ExamError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState title={mn.errors.loadFailed(mn.nav.exam)} error={error} retry={retry} />;
}
