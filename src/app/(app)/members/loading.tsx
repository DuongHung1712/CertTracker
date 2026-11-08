import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header, search and filters, members table.
export default function MembersLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading members">
      <PageHeaderSkeleton titleWidth="w-36" />
      <TableBlockSkeleton />
    </div>
  );
}
