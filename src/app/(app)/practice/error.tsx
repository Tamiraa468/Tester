"use client";

import { ErrorState } from "@/components/states/error-state";
import { mn } from "@/lib/i18n/mn";

export default function PracticeError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState title={mn.errors.loadFailed(mn.nav.practice)} error={error} retry={retry} />;
}
