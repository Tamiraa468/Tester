import { Skeleton } from "@/components/ui/skeleton";
import { mn } from "@/lib/i18n/mn";

/**
 * Skeletons are decoration for the eye only — aria-hidden keeps a screen reader from
 * reading a wall of empty boxes — so every loading.tsx pairs them with this one
 * spoken status.
 */
export function LoadingStatus() {
  return (
    <span className="sr-only" role="status">
      {mn.states.loading}
    </span>
  );
}

/** A list of cards: the shape of /exam history, /review results, recent attempts. */
export function ListSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/** One question with its options: what both players show while an item is fetched. */
export function PlayerSkeleton({ options = 4 }: { options?: number }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <LoadingStatus />
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-1.5 w-full" />
        </div>
        <div className="flex flex-col gap-4 rounded-xl p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-40" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-4/5" />
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: options }, (_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
