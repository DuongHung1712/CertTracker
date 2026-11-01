import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header, then centres, programs and teams sections.
export default function OrgLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading organisation">
      <PageHeaderSkeleton titleWidth="w-44" />
      <TableBlockSkeleton withHeading rows={2} />
      <TableBlockSkeleton withHeading rows={3} />
      <TableBlockSkeleton withHeading rows={4} />
    </div>
  );
}
