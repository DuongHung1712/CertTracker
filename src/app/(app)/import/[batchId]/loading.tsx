import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the batch preview: header, summary tiles, rows table.
export default function ImportBatchLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading import batch">
      <PageHeaderSkeleton titleWidth="w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <TableBlockSkeleton />
    </div>
  );
}
