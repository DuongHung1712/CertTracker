import { MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";

export function ComplianceCopilotCard() {
  return (
    <section
      aria-label="Compliance copilot (Coming soon)"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center gap-1.5">
        <MessageSquare className="size-3.5 text-primary" aria-hidden="true" />
        <h3 className="text-label uppercase tracking-wider font-semibold text-foreground">
          Compliance copilot
        </h3>
      </div>

      <p className="text-xs text-muted-foreground leading-normal">
        Instant policy answers for reimbursement, exam vouchers, and validity.
      </p>

      <div className="flex flex-col gap-2">
        <Input
          disabled
          aria-disabled="true"
          placeholder="Ask about certification policy or exam budget…"
          className="cursor-not-allowed bg-muted/40 text-caption"
        />
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full text-left rounded border border-border bg-muted/40 px-2.5 py-1.5 text-caption text-muted-foreground cursor-not-allowed transition-none"
          >
            What is needed for AWS renewal?
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full text-left rounded border border-border bg-muted/40 px-2.5 py-1.5 text-caption text-muted-foreground cursor-not-allowed transition-none"
          >
            How do I claim exam reimbursement?
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="w-full text-left rounded border border-border bg-muted/40 px-2.5 py-1.5 text-caption text-muted-foreground cursor-not-allowed transition-none"
          >
            Approved courses
          </button>
        </div>
      </div>
    </section>
  );
}
