import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors /review: heading, the three tabs, the start card and a page of questions. */
export default function ReviewLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Ачааллаж байна…
      </span>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>

      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-xl" />

      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
