import { PageHeaderSkeleton } from "@/components/app-shell/loading-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the page: header, account card, career card, password card.
export default function ProfileLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading profile">
      <PageHeaderSkeleton titleWidth="w-32" />
      <Skeleton className="h-32 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}
