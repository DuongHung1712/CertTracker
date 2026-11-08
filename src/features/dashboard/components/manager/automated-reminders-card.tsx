import { BellRing } from "lucide-react";

export function AutomatedRemindersCard() {
  return (
    <section aria-label="Automated reminders" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-label uppercase tracking-wider font-mono text-muted-foreground">
          Automated reminders
        </span>
        <BellRing className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2 rounded border border-border bg-muted/20 p-3 text-caption text-foreground/90 leading-relaxed">
        <p>Members get an expiry email every Monday at 08:00 (Vietnam time).</p>
        <p>The monthly report goes out on the 1st of each month.</p>
      </div>
    </section>
  );
}
