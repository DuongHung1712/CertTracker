import { Skeleton } from "@/components/ui/skeleton";

// Shaped like the redesigned dashboard:
// 1. Header with Filters + Primary action
// 2. 4 tall hero KPI cards (~240px) + slim stat strip (3 stats)
// 3. Compact Expiry strip (~120px)
// 4. Filter row directly above Explorer
// 5. Explorer Master-Detail board (tabs on top, list on left, detail on right)
// 6. Ranking table
export default function DashboardLoading() {
  return (
    <div
      className="flex min-w-0 flex-col gap-6"
      role="status"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* 1. Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-72 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-36" />
        </div>
      </div>

      {/* 2. Overview: 4 tall cards (~240px) + slim stat strip */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-24" />
        </div>
        {/* 4 tall hero cards with chart placeholders in lower half */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={`hero-${i}`}
              className="flex min-h-[235px] flex-col justify-between rounded-lg border border-border bg-card p-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="size-7 rounded-md" />
                </div>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3.5 w-36" />
              </div>
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          ))}
        </div>
        {/* Slim compact stat strip (3 stats) */}
        <div className="grid grid-cols-1 divide-y divide-border rounded-lg border border-border bg-card p-0 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={`stat-${i}`} className="flex flex-col gap-1 p-3.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Certificate expiry: Compact horizontal strip (~120px) directly above Explorer */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>

      {/* 4. Explorer: Filter row + Master-Detail board */}
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-5 w-24" />

        {/* Filter row */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-5 rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
        </div>

        {/* Board */}
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="border-b border-border bg-muted/30 px-4 py-2.5">
            <Skeleton className="h-7 w-80 max-w-full rounded-md" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left list */}
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:col-span-5 lg:border-b-0 lg:border-r">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={`list-item-${i}`} className="h-16 w-full rounded-lg" />
              ))}
            </div>
            {/* Right detail */}
            <div className="flex flex-col gap-4 p-5 lg:col-span-7">
              <Skeleton className="h-8 w-48" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={`sub-card-${i}`} className="h-20 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-28 rounded-lg" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Ranking */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
