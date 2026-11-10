import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header, own records table.
export default function MeLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading my certificates">
      <PageHeaderSkeleton titleWidth="w-48" />
      <TableBlockSkeleton />
    </div>
  );
}
