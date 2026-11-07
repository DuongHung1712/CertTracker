import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the redesigned dashboard: header with action, 4 hero + 3 compact KPIs,
// health row (2/3 expiry + 1/3 donut), tabbed explorer (list + detail), and ranking.
export default function DashboardLoading() {
  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Overview */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-24" />
        </div>
        {/* Hero row: 4 cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`hero-${i}`} className="h-28 rounded-lg" />
          ))}
        </div>
        {/* Compact row: 3 tiles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={`compact-${i}`} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Explorer: Master-Detail board */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-24" />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5">
            <Skeleton className="h-7 w-80 max-w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
              <Skeleton className="h-8.5 w-full rounded-md" />
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={`list-item-${i}`} className="h-16 w-full rounded-lg" />
              ))}
            </div>
            <div className="flex flex-col gap-4 p-5 lg:col-span-7">
              <Skeleton className="h-7 w-48" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={`sub-card-${i}`} className="h-20 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-32 rounded-lg" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Health row (2/3 Expiry + 1/3 Donut) */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-1">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>

      {/* Ranking */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-52 rounded-lg" />
      </div>
    </div>
  );
}
