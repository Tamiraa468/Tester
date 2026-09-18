import { Skeleton } from "@/components/ui/skeleton";
import { ListSkeleton, LoadingStatus } from "@/components/states/page-loading";

/** Mirrors /exam: heading, the preset grid and the history list. */
export default function ExamLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8" aria-busy="true">
      <LoadingStatus />
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton aria-hidden="true" className="h-6 w-44" />
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}
