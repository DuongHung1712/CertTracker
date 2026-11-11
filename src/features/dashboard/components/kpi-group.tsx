import type { ReactNode } from "react";

/** A named block of KPIs inside Overview: the title is its accessible name, so the two kinds are never mixed up. */
export function KpiGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-3">
      <h3 className="font-mono text-label uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}
