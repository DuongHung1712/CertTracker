import { Cloud, Timer } from "lucide-react";
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
            <span>{formatYoe(yoeYears)} tenure</span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground font-medium">Specialization Focus</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
            SOON
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground">
          <Cloud className="size-3.5 text-primary shrink-0" aria-hidden="true" />
          <span>Cloud Architecture</span>
        </div>
      </div>
    </section>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
