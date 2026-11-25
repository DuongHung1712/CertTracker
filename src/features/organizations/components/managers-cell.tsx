"use client";

import { Badge } from "@/components/ui/badge";
import type { ManagerCandidate } from "@/features/organizations/components/scope-managers-field";

const MAX_VISIBLE = 2;

/** Displays assigned managers (and inherited program managers for teams) inside the Organisation tables. */
export function ManagersCell({
  managerIds,
  inheritedManagerIds = [],
  candidates,
}: {
  managerIds: string[];
  inheritedManagerIds?: string[];
  candidates: ManagerCandidate[];
}) {
  const byId = new Map(candidates.map((c) => [c.userId, c.fullName]));
  const direct = managerIds
    .map((userId) => {
      const fullName = byId.get(userId);
      return fullName ? { userId, fullName } : null;
    })
    .filter((entry): entry is { userId: string; fullName: string } => entry !== null);
  const directSet = new Set(managerIds);
  const inheritedOnlyNames = inheritedManagerIds
    .filter((id) => !directSet.has(id))
    .map((id) => byId.get(id))
    .filter((name): name is string => Boolean(name));

  if (direct.length === 0 && inheritedOnlyNames.length === 0) {
    return <span className="text-caption text-muted-foreground">No managers</span>;
  }

  const visibleDirect = direct.slice(0, MAX_VISIBLE);
  const hiddenDirect = direct.length - visibleDirect.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleDirect.map(({ userId, fullName }) => (
        <Badge key={userId} variant="secondary" className="max-w-36 truncate rounded-sm font-normal" title={fullName}>
          {fullName}
        </Badge>
      ))}
      {hiddenDirect > 0 && (
        <Badge variant="secondary" className="rounded-sm font-normal tabular-nums" title={direct.slice(MAX_VISIBLE).map((m) => m.fullName).join(", ")}>
          {`+${hiddenDirect}`}
        </Badge>
      )}
      {inheritedOnlyNames.length > 0 && (
        <Badge
          variant="outline"
          className="rounded-sm font-normal text-muted-foreground"
          title={`Via program: ${inheritedOnlyNames.join(", ")}`}
        >
          {inheritedOnlyNames.length === 1 ? `${inheritedOnlyNames[0]} (program)` : `+${inheritedOnlyNames.length} via program`}
        </Badge>
      )}
    </div>
  );
}
