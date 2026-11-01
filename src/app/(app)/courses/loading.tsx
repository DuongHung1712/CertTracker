import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header, certificate-type and provider sections, courses table.
export default function CoursesLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading courses">
      <PageHeaderSkeleton titleWidth="w-32" />
      <TableBlockSkeleton withHeading rows={3} />
      <TableBlockSkeleton withHeading rows={3} />
      <TableBlockSkeleton withHeading />
    </div>
  );
}
