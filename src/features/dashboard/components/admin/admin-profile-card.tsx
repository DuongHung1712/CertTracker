import { Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatYoe } from "@/features/career/format";
import type { MemberProfile } from "@/features/dashboard/view-model";
import { getInitials } from "@/lib/initials";

export function AdminProfileCard({ profile }: { profile: MemberProfile }) {
  const hasMemberDetails = profile.careerRoleName !== null || profile.yoeYears !== null;

  return (
    <section aria-label="Your profile" className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-label tracking-wider text-muted-foreground">Your profile</span>
        <Badge variant="secondary" className="font-mono text-caption">
          Admin
        </Badge>
      </div>

      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground"
        >
          {getInitials(profile.fullName)}
        </div>
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-sm font-semibold text-foreground">{profile.fullName}</h2>
          {hasMemberDetails ? (
            <>
              <p className="truncate text-xs text-muted-foreground">
                {profile.careerRoleName ?? "Role not set"}
                {profile.teamName ? ` · ${profile.teamName}` : ""}
              </p>
              {profile.yoeYears !== null && (
                <div className="flex items-center gap-1 pt-1.5 font-mono text-xs text-muted-foreground">
                  <Timer className="size-3 shrink-0" aria-hidden="true" />
                  <span>{`${formatYoe(profile.yoeYears)} of experience`}</span>
                </div>
              )}
            </>
          ) : (
            <p className="truncate text-xs text-muted-foreground">Not linked to a member</p>
          )}
        </div>
      </div>
    </section>
  );
}
