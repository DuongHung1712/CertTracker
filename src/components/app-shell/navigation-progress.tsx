"use client";

import { useLinkStatus } from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type Report = (id: string, pending: boolean) => void;

const LoadingContext = createContext(false);
const ReportContext = createContext<Report | null>(null);

/**
 * Collects the pending state of every link that renders `<LinkPendingReporter />`.
 * The bar is "loading" while any reporting link is pending; Next only keeps the
 * last clicked link pending, so the last click wins.
 */
export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set());

  const report = useCallback<Report>((id, pending) => {
    setPendingIds((current) => {
      if (current.has(id) === pending) return current;
      const next = new Set(current);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const loading = useMemo(() => pendingIds.size > 0, [pendingIds]);

  return (
    <ReportContext.Provider value={report}>
      <LoadingContext.Provider value={loading}>{children}</LoadingContext.Provider>
    </ReportContext.Provider>
  );
}

/**
 * Renders nothing. Put it inside an in-app `<Link>` so that link's pending
 * navigation drives the top bar (`useLinkStatus` only works under a `<Link>`).
 */
export function LinkPendingReporter() {
  const { pending } = useLinkStatus();
  const report = useContext(ReportContext);
  const id = useId();

  useEffect(() => {
    report?.(id, pending);
    return () => report?.(id, false);
  }, [id, pending, report]);

  return null;
}

/**
 * The 3px teal bar at the very top (decision #56, design-system §4.4). It is
 * always in the DOM and only changes opacity, so it never shifts the layout.
 * Loading: crawls to ~80% over 2 s and holds. Done: jumps to full width and
 * fades out in 200 ms. Reduced motion: full width, no animation or transition.
 */
export function NavigationProgressBar() {
  const loading = useContext(LoadingContext);

  return (
    <div
      aria-hidden="true"
      data-testid="nav-progress"
      data-state={loading ? "loading" : "idle"}
      className={cn(
        "pointer-events-none fixed top-0 left-0 z-[100] h-[3px] bg-primary",
        loading
          ? "w-0 animate-nav-progress opacity-100 transition-none motion-reduce:w-full motion-reduce:animate-none"
          : "w-full opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none",
      )}
    />
  );
}
