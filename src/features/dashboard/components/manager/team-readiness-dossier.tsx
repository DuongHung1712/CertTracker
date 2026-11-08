"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { buttonVariants } from "@/components/ui/button";
import type { MemberReadinessRow } from "@/features/dashboard/manager-metrics";
import type { RecordRow } from "@/features/records/queries";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function TeamReadinessDossier({
  rows,
  records,
}: {
  rows: MemberReadinessRow[];
  records: RecordRow[];
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    rows[0]?.memberId ?? "",
  );

  const selectedRow = useMemo(
    () => rows.find((r) => r.memberId === selectedMemberId) ?? rows[0],
    [rows, selectedMemberId],
  );

  const selectedRecords = useMemo(
    () => (selectedRow ? records.filter((r) => r.memberId === selectedRow.memberId) : []),
    [records, selectedRow],
  );

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center text-caption text-muted-foreground">
        No team members found in your managed scope.
      </div>
    );
  }

  const compliantPercent = selectedRow?.readinessRate ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase font-mono">
            Team readiness dossier · Compliance ranking
          </h2>
        </div>
        <span className="text-caption text-muted-foreground hidden sm:inline">
          Click person to inspect dossier
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Subpanel: Master List (5 cols on lg) */}
        <div className="flex flex-col gap-2 lg:col-span-5 max-h-[520px] overflow-y-auto pr-1">
          {rows.map((row, idx) => {
            const isSelected = row.memberId === selectedRow?.memberId;
            const initials = getInitials(row.memberName);

            return (
              <button
                type="button"
                key={row.memberId}
                role="row"
                onClick={() => setSelectedMemberId(row.memberId)}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted/50",
                )}
              >
                {/* Top line: Rank, Initials, Name, Readiness % */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        "text-caption font-mono font-semibold shrink-0 w-5",
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      #{idx + 1}
                    </span>
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold font-mono",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-foreground",
                      )}
                      aria-hidden="true"
                    >
                      {initials}
                    </span>
                    <span className="font-semibold text-caption truncate">
                      {row.memberName}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "font-mono font-bold text-caption tabular-nums shrink-0",
                      isSelected ? "text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {row.readinessRate}%
                  </span>
                </div>

                {/* Subtitle: Team Name, Valid & In Progress counts */}
                <div className="flex items-center justify-between text-caption">
                  <span
                    className={cn(
                      "truncate",
                      isSelected ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {row.teamName ?? "No team"}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-mono text-caption",
                      isSelected ? "text-primary-foreground/90" : "text-muted-foreground",
                    )}
                  >
                    {row.validCount} valid · {row.inProgressCount} in progress
                  </span>
                </div>

                {/* Mini Segmented Bar */}
                <div
                  className={cn(
                    "h-1.5 w-full rounded-full overflow-hidden flex",
                    isSelected ? "bg-primary-foreground/20" : "bg-muted",
                  )}
                  aria-hidden="true"
                >
                  {row.validCount > 0 && (
                    <div
                      style={{
                        width: `${Math.round((row.validCount / Math.max(1, row.totalCount)) * 100)}%`,
                      }}
                      className={isSelected ? "bg-primary-foreground" : "bg-primary"}
                    />
                  )}
                  {row.inProgressCount > 0 && (
                    <div
                      style={{
                        width: `${Math.round((row.inProgressCount / Math.max(1, row.totalCount)) * 100)}%`,
                      }}
                      className={isSelected ? "bg-primary-foreground/50" : "bg-muted-foreground/40"}
                    />
                  )}
                  {row.expiredCount > 0 && (
                    <div
                      style={{
                        width: `${Math.round((row.expiredCount / Math.max(1, row.totalCount)) * 100)}%`,
                      }}
                      className="bg-[var(--status-expired-fg)]"
                    />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Subpanel: Detail Dossier (7 cols on lg) */}
        {selectedRow && (
          <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 lg:col-span-7">
            {/* Dossier Banner */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
                Detail view · Member dossier
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-medium border",
                  compliantPercent === 100
                    ? "border-[var(--status-valid-border)] bg-[var(--status-valid-bg)] text-[var(--status-valid-fg)]"
                    : "border-border bg-muted text-muted-foreground",
                )}
              >
                <CheckCircle2 className="size-3" aria-hidden="true" />
                <span>{compliantPercent}% Compliant</span>
              </span>
            </div>

            {/* Member Identity */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono font-semibold">
                {getInitials(selectedRow.memberName)}
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">
                  {selectedRow.memberName}
                </h3>
                <span className="text-caption text-muted-foreground truncate">
                  {selectedRow.teamName ?? "No team assigned"} · Team member
                </span>
              </div>
            </div>

            {/* 4 Mini Stat Figure Cards */}
            <div className="grid grid-cols-4 gap-2">
              <div className="flex flex-col items-center justify-center rounded border border-border bg-muted/30 p-2 text-center">
                <span className="text-label uppercase font-mono text-muted-foreground">Valid</span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {selectedRow.validCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded border border-border bg-muted/30 p-2 text-center">
                <span className="text-label uppercase font-mono text-muted-foreground">Completed</span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {selectedRow.validCount + selectedRow.expiredCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded border border-border bg-muted/30 p-2 text-center">
                <span className="text-label uppercase font-mono text-muted-foreground">In progress</span>
                <span className="text-lg font-bold font-mono tabular-nums text-foreground">
                  {selectedRow.inProgressCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center rounded border border-border bg-muted/30 p-2 text-center">
                <span className="text-label uppercase font-mono text-muted-foreground">Expired</span>
                <span
                  className={cn(
                    "text-lg font-bold font-mono tabular-nums",
                    selectedRow.expiredCount > 0
                      ? "text-[var(--status-expired-fg)]"
                      : "text-foreground",
                  )}
                >
                  {selectedRow.expiredCount}
                </span>
              </div>
            </div>

            {/* Registered Certificates List */}
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
                Registered certificates
              </span>

              {selectedRecords.length === 0 ? (
                <div className="rounded border border-dashed border-border p-4 text-center text-caption text-muted-foreground">
                  No certificates recorded yet for this member.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded border border-border bg-background">
                  {selectedRecords.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 p-3 text-caption"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-foreground truncate">
                          {r.courseName}
                        </span>
                        <span className="text-caption text-muted-foreground font-mono truncate">
                          ID: {r.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <div className="shrink-0">
                        <ExpiryBadge
                          status={r.expiryStatus}
                          daysToExpiry={r.daysToExpiry}
                          expiryDate={r.expiryDate}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3 mt-auto">
              <Link
                href={`/records?search=${encodeURIComponent(selectedRow.memberName)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-caption")}
              >
                View member certificates
              </Link>
              <button
                type="button"
                disabled
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "border-dashed text-caption opacity-60 cursor-not-allowed",
                )}
                title="Goal assignment is not available yet."
              >
                Assign goal (Soon)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
