import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the page: header, tab strip, the active table, and the admin sections for types and providers.
export default function CatalogueLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading catalogue">
      <PageHeaderSkeleton titleWidth="w-32" />
      <Skeleton className="h-9 w-48 rounded-lg" />
      <TableBlockSkeleton />
      <TableBlockSkeleton withHeading rows={2} />
      <TableBlockSkeleton withHeading rows={2} />
    </div>
  );
}
