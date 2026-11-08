"use client";

import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExportLinks } from "@/features/export/components/export-links";
import { cn } from "@/lib/utils";

export function AdminHeader({
  greeting,
  subtitle,
}: {
  greeting: string;
  subtitle: string;
}) {
  function scrollToFilters() {
    const el = document.getElementById("dashboard-filters");
    if (!el) return;
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    const searchInput = el.querySelector("input");
    if (searchInput instanceof HTMLElement) {
      searchInput.focus();
    } else {
      el.focus();
    }
  }

  return (
    <PageHeader
      title="Dashboard"
      description={`${greeting} · ${subtitle}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={scrollToFilters}
            className="gap-1.5 text-caption font-medium"
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Filters</span>
          </Button>
          <ExportLinks label="Download data" />
          <Link
            href="/records"
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5")}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>Add certificate</span>
          </Link>
        </div>
      }
    />
  );
}
