import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { MemberSkillSummary } from "@/features/skills/types";
import { formatNumber } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

const EMPTY_SUMMARY: MemberSkillSummary = {
  totalSkills: 0,
  certifiedCount: 0,
  pendingReviewCount: 0,
  returnedCount: 0,
  averageLevel: 0,
};

/** Live skills summary for the Member Dashboard. Link text intentionally avoids "My skills" to keep sidebar selectors unique. */
export function SkillsMatrixCard({ summary = EMPTY_SUMMARY }: { summary?: MemberSkillSummary }) {
  const hasSkills = summary.totalSkills > 0;

  return (
    <section
      aria-label="My skills"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-section-title font-semibold text-foreground">My skills</h2>
        <Compass className="size-4 text-primary" aria-hidden="true" />
      </div>

      {hasSkills ? (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background/50 p-2.5">
              <dt className="text-label uppercase text-muted-foreground">Rated skills</dt>
              <dd className="text-body font-semibold tabular-nums text-foreground">
                {formatNumber(summary.totalSkills)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background/50 p-2.5">
              <dt className="text-label uppercase text-muted-foreground">Average level</dt>
              <dd className="text-body font-semibold tabular-nums text-foreground">
                {summary.averageLevel.toFixed(1)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background/50 p-2.5">
              <dt className="text-label uppercase text-muted-foreground">Certified</dt>
              <dd className="text-body font-semibold tabular-nums text-foreground">
                {formatNumber(summary.certifiedCount)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 rounded-md border border-border bg-background/50 p-2.5">
              <dt className="text-label uppercase text-muted-foreground">Waiting for review</dt>
              <dd className="text-body font-semibold tabular-nums text-foreground">
                {formatNumber(summary.pendingReviewCount)}
              </dd>
            </div>
          </dl>

          {summary.returnedCount > 0 && (
            <p className="text-caption font-medium text-destructive">
              {pluralize(summary.returnedCount, "skill")} returned for changes
            </p>
          )}

          <Link
            href="/skills"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
          >
            View skills
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-body font-medium text-foreground">No skills rated yet</p>
            <p className="text-caption text-muted-foreground">
              Rate the skills you use and link certificates for verified status.
            </p>
          </div>
          <Link
            href="/skills"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}
          >
            Rate skills
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}
