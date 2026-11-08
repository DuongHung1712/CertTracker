"use client";

import Link from "next/link";
import { ListChecks, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardHeaderActions() {
  function handleScrollToFilters() {
    const el = document.getElementById("dashboard-filters");
    if (el) {
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
      const input = document.getElementById("explorer-search-input");
      input?.focus({ preventScroll: true });
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleScrollToFilters}
        className="gap-1.5"
      >
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span>Filters</span>
      </Button>
      <Link
        href="/records"
        className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
      >
        <ListChecks className="size-4" aria-hidden />
        <span>View certificates</span>
      </Link>
    </div>
  );
}
