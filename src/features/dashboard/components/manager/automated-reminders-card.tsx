import { BellRing } from "lucide-react";
import { pluralize } from "@/lib/plural";

export function AutomatedRemindersCard({ expiringCount }: { expiringCount: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Automated reminders
        </span>
        <BellRing className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="rounded border border-border bg-muted/20 p-3 text-caption text-foreground/90 leading-relaxed">
        Auto-reminder sent every Monday 08:00 to members with expiring certificates. Last sent Monday to{" "}
        <strong className="font-semibold text-foreground font-mono">
          {pluralize(expiringCount, "team member")}
        </strong>
        .
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2 text-caption">
        <span className="text-muted-foreground">Monthly audit report: next on 1 Dec</span>
        <a
          href="/api/export/records?format=csv"
          className="font-medium text-primary hover:underline"
        >
          Preview
        </a>
      </div>
    </div>
  );
}
