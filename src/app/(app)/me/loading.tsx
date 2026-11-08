import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the page: header, career card, own records table.
export default function MeLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading my certificates">
      <PageHeaderSkeleton titleWidth="w-48" />
      <Skeleton className="h-24 rounded-lg" />
      <TableBlockSkeleton />
    </div>
  );
}
