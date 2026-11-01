import { PageHeaderSkeleton, TableBlockSkeleton } from "@/components/app-shell/loading-skeleton";

// Shaped like the page: header, career roles section, e-mail run history.
export default function SettingsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading settings">
      <PageHeaderSkeleton titleWidth="w-36" />
      <TableBlockSkeleton withHeading rows={4} />
      <TableBlockSkeleton withHeading rows={3} />
    </div>
  );
}
