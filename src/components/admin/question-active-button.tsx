"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setQuestionActive } from "@/server/actions/admin/questions";

/** Activates or deactivates a question; the action stores the target state, not a flip. */
export function QuestionActiveButton({
  questionId,
  isActive,
}: {
  questionId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = () => {
    if (pending) return;
    startTransition(async () => {
      const result = await setQuestionActive({ questionId, isActive: !isActive });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.isActive ? "Идэвхжүүллээ." : "Идэвхгүй болголоо.");
      router.refresh();
    });
  };

  return (
    <Button type="button" variant="ghost" size="sm" onClick={change} disabled={pending} className="h-8">
      {isActive ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      {isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
    </Button>
  );
}
