import { Skeleton } from "@/components/ui/skeleton";

// Deliberately matches no role: the Admin, Manager and Member dashboards differ, and a skeleton shaped like one
// of them jumps when another arrives. Header, one row of compact cards, two content blocks; it only ever fills
// the width the page already has.
export default function DashboardLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-6" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40 max-w-full" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-4 w-24 max-w-full" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-36 max-w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
