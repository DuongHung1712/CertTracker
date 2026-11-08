import { pluralize } from "@/lib/plural";

export function AllocatedScopeCard({
  teams,
}: {
  teams: { name: string; memberCount: number }[];
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Allocated scope
        </span>
      </div>

      <div className="flex flex-col divide-y divide-border text-caption">
        {teams.map((t) => (
          <div key={t.name} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
            <span className="font-medium text-foreground">{t.name}</span>
            <span className="font-mono text-muted-foreground">
              {pluralize(t.memberCount, "member")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
