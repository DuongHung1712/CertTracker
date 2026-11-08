import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the page: header, upload card, export links, import history table.
export default function ImportLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading import and export">
      <PageHeaderSkeleton titleWidth="w-48" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-36" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>
      <TableBlockSkeleton withHeading rows={3} />
    </div>
  );
}
