"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReportStatus } from "@/generated/prisma/enums";
import { setReportStatus } from "@/server/actions/admin/reports";

/**
 * Resolves a report, or puts it back in the queue. The action is told the status to
 * store rather than to flip it, so a double click settles on what was asked for.
 */
export function ReportStatusButton({
  reportId,
  status,
}: {
  reportId: string;
  status: ReportStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const resolved = status === ReportStatus.RESOLVED;
  const next = resolved ? ReportStatus.OPEN : ReportStatus.RESOLVED;

  const change = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await setReportStatus({ reportId, status: next });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(resolved ? "Дахин нээлээ." : "Шийдвэрлэсэн гэж тэмдэглэлээ.");
      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant={resolved ? "ghost" : "outline"}
      size="sm"
      onClick={change}
      disabled={pending}
      className="h-9 shrink-0"
    >
      {resolved ? <RotateCcwIcon aria-hidden="true" /> : <CheckIcon aria-hidden="true" />}
      {resolved ? "Дахин нээх" : "Шийдвэрлэсэн"}
    </Button>
  );
}
