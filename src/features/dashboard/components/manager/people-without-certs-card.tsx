import { getInitials } from "@/lib/initials";

export function PeopleWithoutCertsCard({
  members,
}: {
  members: { id: string; fullName: string; teamName: string | null }[];
}) {
  if (members.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
            People without certificates yet ({members.length})
          </span>
        </div>
        <span className="rounded border border-[var(--status-expiring-soon-border)] bg-[var(--status-expiring-soon-bg)] px-2 py-0.5 text-caption font-medium text-[var(--status-expiring-soon-fg)]">
          Attention needed
        </span>
      </div>

      <p className="text-caption text-muted-foreground">
        Onboarded team members with no recorded certificates.
      </p>

      <div className="flex flex-col divide-y divide-border">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-caption font-semibold text-foreground"
                aria-hidden="true"
              >
                {getInitials(m.fullName)}
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-caption text-foreground truncate">
                  {m.fullName}
                </span>
                <span className="text-caption text-muted-foreground truncate">
                  {m.teamName ?? "No team assigned"}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
