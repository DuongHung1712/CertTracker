import { formatYoe } from "@/features/career/format";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

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
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold text-base"
          >
            {initials}
          </div>
          <div className="flex flex-col">
            <h2 className="text-section-title font-semibold text-foreground">{fullName}</h2>
            <p className="text-body text-muted-foreground">
              {careerRoleName ?? "Role not set"}
              <span className="mx-1.5 opacity-50">·</span>
              {teamName ?? "No team assigned"}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-1.5 text-caption text-muted-foreground self-start sm:self-center">
          <span className="font-medium text-foreground">{formatYoe(yoeYears)}</span> of experience
        </div>
      </div>

      {/* Embedded Specialization focus coming-soon block */}
      <ComingSoonCard
        title="Specialization focus"
        description="Choose a technology track to receive tailored course recommendations."
        className="bg-background/50 border-border/80"
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
