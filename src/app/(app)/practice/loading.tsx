import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/states/page-loading";

/** Mirrors /practice: heading, the setup card, and the unfinished-attempt list. */
export default function PracticeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6" aria-busy="true">
      <LoadingStatus />
      <div aria-hidden="true" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-40" />
        <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-11 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
