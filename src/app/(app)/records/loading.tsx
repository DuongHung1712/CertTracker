import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header with export actions, filter bar, records table.
export default function RecordsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading records">
      <PageHeaderSkeleton titleWidth="w-36" />
      <TableBlockSkeleton />
    </div>
  );
}
