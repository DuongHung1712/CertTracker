import { Timer } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { formatYoe } from "@/features/career/format";

export function MemberProfileCard({
  fullName,
  teamName,
  careerRoleName,
  yoeYears,
}: {
  fullName: string;
  teamName: string | null;
  careerRoleName: string | null;
  yoeYears: number | null;
}) {
  const initials = getInitials(fullName);

  return (
    <section
      aria-label="Member profile"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono font-bold text-sm"
        >
          {initials}
        </div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-sm font-semibold text-foreground truncate">{fullName}</h2>
          <p className="text-xs text-muted-foreground truncate">
            {careerRoleName ?? "Role not set"} · {teamName ?? "No team assigned"}
          </p>
          <div className="flex items-center gap-1 pt-1.5 text-xs font-mono text-muted-foreground">
            <Timer className="size-3 shrink-0" aria-hidden="true" />
            <span>{yoeYears === null ? "Experience not set" : `${formatYoe(yoeYears)} of experience`}</span>
          </div>
        </div>
      </div>

      <ComingSoonCard
        title="Focus area"
        description="Choose the area you want to grow in, such as cloud or security. Not available yet."
      />
    </section>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
