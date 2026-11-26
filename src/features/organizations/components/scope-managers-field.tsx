"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { foldText } from "@/lib/text";
import { cn } from "@/lib/utils";

export type ManagerCandidate = { userId: string; fullName: string; email: string };

export function ScopeManagersField({
  candidates,
  selected,
  inheritedIds = [],
  onChange,
}: {
  candidates: ManagerCandidate[];
  selected: string[];
  /** For teams: manager userIds who already manage this team through its parent program. */
  inheritedIds?: string[];
  onChange: (userIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const inheritedSet = useMemo(() => new Set(inheritedIds), [inheritedIds]);

  const selectedCandidates = useMemo(
    () => candidates.filter((c) => selectedSet.has(c.userId)),
    [candidates, selectedSet],
  );

  const filtered = useMemo(() => {
    const q = foldText(search);
    if (!q) return candidates;
    return candidates.filter((c) => foldText(`${c.fullName} ${c.email}`).includes(q));
  }, [candidates, search]);

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center">
        <p className="text-body font-medium text-foreground">No managers available</p>
        <p className="mt-0.5 text-caption text-muted-foreground">
          No account has the Manager role yet. Assign the Manager role in Members first.
        </p>
      </div>
    );
  }

  function toggle(userId: string, checked: boolean) {
    if (checked) {
      if (!selectedSet.has(userId)) onChange([...selected, userId]);
    } else {
      onChange(selected.filter((id) => id !== userId));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Selected summary bar + removable chips */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-caption font-medium text-muted-foreground tabular-nums">
            {selected.length === 0 ? "None selected" : `${selected.length} selected`}
          </span>
          {selected.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-6 px-2 text-caption text-muted-foreground hover:text-foreground"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          )}
        </div>
        {selectedCandidates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedCandidates.map((candidate) => (
              <Badge key={candidate.userId} variant="secondary" className="gap-1 rounded-sm pr-1 font-normal">
                <span className="max-w-40 truncate">{candidate.fullName}</span>
                <button
                  type="button"
                  onClick={() => toggle(candidate.userId, false)}
                  aria-label={`Remove ${candidate.fullName}`}
                  className="inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search managers by name or email…"
          aria-label="Search managers by name or email"
          className="h-8 pl-8"
        />
      </div>

      {/* Candidate checklist */}
      <div className="h-60 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-caption text-muted-foreground">
            No matching managers found.
          </div>
        ) : (
          filtered.map((candidate) => {
            const checked = selectedSet.has(candidate.userId);
            const inherited = inheritedSet.has(candidate.userId);
            const id = `manager-${candidate.userId}`;
            return (
              <label
                key={candidate.userId}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50",
                  checked && "bg-primary/5",
                )}
              >
                <Checkbox
                  id={id}
                  className="mt-0.5 shrink-0"
                  checked={checked}
                  onCheckedChange={(next) => toggle(candidate.userId, Boolean(next))}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-body font-medium text-foreground">{candidate.fullName}</span>
                    {inherited && (
                      <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[11px] font-normal text-muted-foreground">
                        Via program
                      </Badge>
                    )}
                  </span>
                  <span className="truncate text-caption text-muted-foreground">{candidate.email}</span>
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
