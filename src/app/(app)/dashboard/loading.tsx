import { Skeleton } from "@/components/ui/skeleton";
import { LoadingStatus } from "@/components/states/page-loading";

/** Mirrors the dashboard's layout: KPI row, subject bars, chart, recent attempts. */
export default function DashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8" aria-busy="true">
      <LoadingStatus />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>

      <Skeleton className="h-24 rounded-xl" />

      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-48" />
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-1 w-full" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
  );
}
