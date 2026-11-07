"use client";

import Link from "next/link";
import { ListChecks, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardHeaderActions({ isMember }: { isMember: boolean }) {
  function handleScrollToFilters() {
    const el = document.getElementById("dashboard-filters");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const input = document.getElementById("explorer-search-input");
      input?.focus();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleScrollToFilters}
        className="min-h-[44px] gap-1.5 sm:min-h-[36px]"
        aria-label="Scroll to filters"
      >
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span>Filters</span>
      </Button>
      <Link
        href={isMember ? "/me" : "/records"}
        className={cn(buttonVariants(), "min-h-[44px] gap-1.5 sm:min-h-[36px]")}
      >
        <ListChecks className="size-4" aria-hidden />
        <span>{isMember ? "My certificates" : "View records"}</span>
      </Link>
    </div>
  );
}
