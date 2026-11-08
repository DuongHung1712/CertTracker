import { CheckCircle2, ShieldCheck } from "lucide-react";

export function AuditVerificationCard() {
  return (
    <section
      aria-label="Audit verification (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-label uppercase tracking-wider font-semibold text-foreground">
            Audit verification
          </h3>
        </div>
        <span className="rounded border border-border px-1.5 py-0.5 text-caption font-semibold text-foreground">
          0 Pending
        </span>
      </div>

      <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/20 p-2.5">
        <CheckCircle2 className="size-4 shrink-0 text-[var(--status-active-fg)] mt-0.5" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">All clear!</span>
          <p className="text-caption text-muted-foreground leading-normal">
            You have no pending actions, renewal audits, or unverified badge uploads.
          </p>
        </div>
      </div>
    </section>
  );
}
