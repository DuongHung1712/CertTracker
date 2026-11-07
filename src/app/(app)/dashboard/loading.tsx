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

      {/* Health row (2/3 Expiry + 1/3 Donut) */}
      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <div className="lg:col-span-1 flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      </div>

      {/* Explorer */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-72 max-w-full rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 flex flex-col gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
          <div className="lg:col-span-5">
            <Skeleton className="h-64 rounded-lg" />
          </div>
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
