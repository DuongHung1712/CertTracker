import { Award, Compass, FileCheck2, MessageSquare, Target } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { Input } from "@/components/ui/input";

export function MemberComingSoonStack() {
  return (
    <div className="flex flex-col gap-3.5">
      {/* 1. Compliance copilot with disabled input and 3 question chips */}
      <ComingSoonCard
        title="Compliance copilot"
        description="Ask questions about certification policy, renewal timelines, and exam budgets."
        icon={<MessageSquare className="size-4" aria-hidden="true" />}
      >
        <div className="flex flex-col gap-2">
          <Input
            disabled
            aria-disabled="true"
            placeholder="Ask about certification policy or exam budget…"
            className="cursor-not-allowed bg-muted/40 text-caption"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded border border-border bg-muted/40 px-2 py-1 text-caption text-muted-foreground cursor-not-allowed transition-none"
            >
              What is needed for AWS renewal?
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded border border-border bg-muted/40 px-2 py-1 text-caption text-muted-foreground cursor-not-allowed transition-none"
            >
              Eligible courses for Cloud team
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="rounded border border-border bg-muted/40 px-2 py-1 text-caption text-muted-foreground cursor-not-allowed transition-none"
            >
              Refund policy deadline
            </button>
          </div>
        </div>
      </ComingSoonCard>

      {/* 2. My skills matrix */}
      <ComingSoonCard
        title="My skills matrix"
        description="Map verified competencies and certifications against team skill benchmarks."
        icon={<Compass className="size-4" aria-hidden="true" />}
      />

      {/* 3. Quarterly objective */}
      <ComingSoonCard
        title="Quarterly objective"
        description="Set personal certification targets aligned with department OKRs."
        icon={<Target className="size-4" aria-hidden="true" />}
      />

      {/* 4. Target role */}
      <ComingSoonCard
        title="Target role"
        description="Track required certifications for progression to the next career band."
        icon={<Award className="size-4" aria-hidden="true" />}
      />

      {/* 5. Audit verification */}
      <ComingSoonCard
        title="Audit verification"
        description="Generate verifiable credential links for client audits and partner tenders."
        icon={<FileCheck2 className="size-4" aria-hidden="true" />}
      />
    </div>
  );
}
