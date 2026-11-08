import { Clock, HelpCircle, ShieldAlert, Sparkles, Target } from "lucide-react";
import { ComingSoonCard } from "@/components/status/coming-soon-card";
import { Button } from "@/components/ui/button";

export function ManagerTabStrip() {
  return (
    <div
      role="tablist"
      aria-label="Manager dashboard views"
      className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3"
    >
      <button
        type="button"
        role="tab"
        aria-selected="true"
        className="rounded-md bg-primary px-3 py-1.5 text-caption font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Overview
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-1.5 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Approvals</span>
        <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Soon</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-1.5 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Goals</span>
        <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Soon</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected="false"
        disabled
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-1.5 text-caption font-medium text-muted-foreground opacity-60 cursor-not-allowed"
      >
        <span>Skills</span>
        <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">Soon</span>
      </button>
    </div>
  );
}

export function ApprovalsQueueComingSoon() {
  return (
    <ComingSoonCard
      title="Approvals queue"
      description="Review and verify certificate evidence submitted by team members. Not available yet."
      icon={<Clock className="size-4" />}
    >
      <div className="flex flex-col gap-2">
        <Button disabled size="sm" variant="outline" className="w-fit">
          Review queued evidence
        </Button>
      </div>
    </ComingSoonCard>
  );
}

export function GoalsComingSoon() {
  return (
    <ComingSoonCard
      title="Goals"
      description="Quarterly team certification targets and completion milestones. Not available yet."
      icon={<Target className="size-4" />}
    >
      <div className="flex flex-col gap-2">
        <Button disabled size="sm" variant="outline" className="w-fit">
          Set quarterly goal
        </Button>
      </div>
    </ComingSoonCard>
  );
}

export function SkillsComingSoon() {
  return (
    <ComingSoonCard
      title="Skills"
      description="Team capability coverage and capability gaps against role blueprints. Not available yet."
      icon={<Sparkles className="size-4" />}
    >
      <div className="flex flex-col gap-2">
        <Button disabled size="sm" variant="outline" className="w-fit">
          View skill matrix
        </Button>
      </div>
    </ComingSoonCard>
  );
}

export function AskAboutMyTeamComingSoon() {
  return (
    <ComingSoonCard
      title="Ask about my team"
      description="Ask natural-language questions about team qualifications, exam budgets, or skill gaps. Not available yet."
      icon={<HelpCircle className="size-4" />}
    >
      <div className="flex flex-col gap-2.5">
        <input
          type="text"
          disabled
          placeholder="Ask about team qualifications or skill gaps…"
          className="h-8 w-full rounded-md border border-input bg-muted/40 px-3 text-caption text-muted-foreground cursor-not-allowed"
        />
        <div className="flex flex-wrap gap-1.5">
          <Button disabled size="sm" variant="outline" className="h-7 text-caption">
            Cloud certification coverage?
          </Button>
          <Button disabled size="sm" variant="outline" className="h-7 text-caption">
            Renewals this quarter?
          </Button>
        </div>
      </div>
    </ComingSoonCard>
  );
}

export function RiskAlertsComingSoon() {
  return (
    <ComingSoonCard
      title="Risk alerts"
      description="Identifies single points of failure when critical capabilities depend on expiring certificates. Not available yet."
      icon={<ShieldAlert className="size-4" />}
    >
      <div className="flex flex-col gap-2">
        <Button disabled size="sm" variant="outline" className="w-fit">
          View risk assessment
        </Button>
      </div>
    </ComingSoonCard>
  );
}
