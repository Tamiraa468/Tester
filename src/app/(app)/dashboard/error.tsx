"use client";

import { ErrorState } from "@/components/states/error-state";
import { mn } from "@/lib/i18n/mn";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState title={mn.errors.loadFailed(mn.nav.dashboard)} error={error} retry={retry} />;
}
