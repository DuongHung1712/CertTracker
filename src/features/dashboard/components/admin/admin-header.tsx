"use client";

import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { ExportLinks } from "@/features/export/components/export-links";

function focusGroupFilters() {
  const filters = document.getElementById("dashboard-filters");
  if (!filters) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  filters.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  // Base UI renders an aria-hidden input per select: skip those and land on the search box.
  const search = filters.querySelector<HTMLElement>('input:not([aria-hidden="true"])');
  (search ?? filters).focus();
}

export function AdminHeader({ greeting, subtitle }: { greeting: string; subtitle: string }) {
  return (
    <PageHeader
      title="Dashboard"
      description={`${greeting} · ${subtitle}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={focusGroupFilters} className="gap-1.5 text-caption font-medium">
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            <span>Filter groups</span>
          </Button>
          <ExportLinks label="Export CSV" />
        </div>
      }
    />
  );
}
