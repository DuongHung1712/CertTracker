import { HelpCircle } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";

export function ManagerTabStrip() {
  return (
    <div
      role="tablist"
      aria-label="Manager dashboard views"
      className="flex flex-wrap items-center gap-2 border-b border-border pb-3"
    >
      <button
        type="button"
        role="tab"
        aria-selected="true"
        className="rounded-full bg-primary px-3.5 py-1 text-caption font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-label="Approvals Soon"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/30 px-3.5 py-1 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Approvals</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-caption text-muted-foreground font-mono">
          Soon
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-label="Skills Soon"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/30 px-3.5 py-1 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Skills</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-caption text-muted-foreground font-mono">
          Soon
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-label="Goals Soon"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-muted/30 px-3.5 py-1 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Goals</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-caption text-muted-foreground font-mono">
          Soon
        </span>
      </button>
    </div>
  );
}

export function AskAboutMyTeamComingSoon() {
  return (
    <ComingSoonCard
      title="Ask about my team"
      description="Ask questions about your team's certificates and get alerts about certificate risks. Not available yet."
      icon={<HelpCircle className="size-4" />}
    />
  );
}
