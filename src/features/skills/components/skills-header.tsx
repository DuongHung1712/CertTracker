import { HelpCircle, ListChecks } from "lucide-react";
import type { RoleBenchmark, SkillStats } from "../types";
import { KpiTile } from "@/components/data/kpi-tile";
import { Button } from "@/components/ui/button";

interface SkillsHeaderProps {
  stats: SkillStats;
  benchmark: RoleBenchmark;
  onOpenGuide: () => void;
  onOpenBatchAssess: () => void;
}

/** The member's role, the two page-level actions, and four numbers that answer "how am I doing?". */
export function SkillsHeader({ stats, benchmark, onOpenGuide, onOpenBatchAssess }: SkillsHeaderProps) {
  const ofTotal = `of ${stats.totalSkills} skills`;

  return (
    <section aria-label="Summary" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-section-title text-foreground">
            {benchmark.roleName}
            <span className="font-normal text-muted-foreground"> · {benchmark.teamName}</span>
          </h2>
          <p className="max-w-prose text-caption text-muted-foreground">
            The skills below are the ones this role uses. {benchmark.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenGuide}>
            <HelpCircle aria-hidden />
            Level guide
          </Button>
          <Button type="button" size="sm" onClick={onOpenBatchAssess}>
            <ListChecks aria-hidden />
            Update skill rate
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Average level" value={stats.averageLevel.toFixed(1)} hint="on a 0–5 scale" />
        <KpiTile label="Level 4 or higher" value={stats.strongCount} hint={ofTotal} />
        <KpiTile
          label="Certified"
          value={stats.certifiedCount}
          hint={`${ofTotal} · ${stats.certifiedPercentage}%`}
          verified={stats.certifiedCount > 0}
        />
        <KpiTile label="Waiting for review" value={stats.pendingReviewCount} hint="level 5 needs your manager" />
      </dl>
    </section>
  );
}
