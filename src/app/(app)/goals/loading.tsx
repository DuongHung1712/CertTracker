import { PageHeaderSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function GoalsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading quarterly goals">
      <PageHeaderSkeleton titleWidth="w-44" />
      <Skeleton className="h-36 max-w-2xl rounded-lg" />
    </div>
  );
}
