import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared frame of the Overview cards: label row, body, and a footer under a rule. */
export function KpiTile({
  label,
  badge,
  solid = false,
  footer,
  children,
}: {
  label: string;
  badge?: ReactNode;
  solid?: boolean;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-between gap-3 rounded-lg p-4",
        solid ? "bg-primary text-primary-foreground" : "border border-border bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-label tracking-wider",
            solid ? "text-primary-foreground-muted" : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {badge}
      </div>
      {children}
      <div className={cn("min-w-0 border-t pt-2", solid ? "border-primary-foreground/20" : "border-border")}>
        {footer}
      </div>
    </div>
  );
}

export function KpiFigure({
  term,
  value,
  tone = "text-foreground",
  hideTerm = false,
}: {
  term: string;
  value: number;
  tone?: string;
  hideTerm?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className={cn("text-xs text-muted-foreground", hideTerm && "sr-only")}>{term}</dt>
      <dd className={cn("font-mono text-2xl font-bold tracking-tight", tone)}>{value}</dd>
    </div>
  );
}
