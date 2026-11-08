import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { formatYoe } from "@/features/career/format";
import type { MemberProfile } from "@/features/dashboard/view-model";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AdminProfileCard({ profile }: { profile: MemberProfile }) {
  const initials = getInitials(profile.fullName);
  const hasMemberDetails = profile.careerRoleName !== null || profile.yoeYears !== null;

  return (
    <section
      aria-label="Workspace ledger"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Workspace ledger
        </span>
        <Badge variant="secondary" className="font-mono text-caption">
          Admin
        </Badge>
      </div>

      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm"
        >
          {initials}
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{profile.fullName}</h2>
          {hasMemberDetails ? (
            <>
              <p className="text-xs text-muted-foreground truncate">
                {profile.careerRoleName ?? "Role not set"}
                {profile.teamName ? ` · ${profile.teamName}` : ""}
              </p>
              {profile.yoeYears !== null && (
                <div className="flex items-center gap-1 pt-1.5 text-xs font-mono text-muted-foreground">
                  <Timer className="size-3 shrink-0" aria-hidden="true" />
                  <span>{`${formatYoe(profile.yoeYears)} of experience`}</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground truncate">System administrator</p>
          )}
        </div>
      </div>

      <ComingSoonCard
        title="Track specialization"
        description="Phase 2 · Chosen field or track specialization. Not available yet."
      />
    </section>
  );
}
