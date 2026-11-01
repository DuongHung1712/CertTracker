import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for `PageHeader`: title and one-line description. */
export function PageHeaderSkeleton({ titleWidth = "w-40" }: { titleWidth?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={`h-8 ${titleWidth}`} />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}

/** Placeholder for a titled section holding a table (heading, toolbar, header row, 5 rows). */
export function TableBlockSkeleton({ withHeading = false, rows = 5 }: { withHeading?: boolean; rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {withHeading && <Skeleton className="h-6 w-48" />}
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-full sm:w-72" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border p-2.5">
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
