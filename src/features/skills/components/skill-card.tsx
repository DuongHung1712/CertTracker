import { Award } from "lucide-react";
import { categoryLabel } from "../metrics";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill, SkillLevel } from "../types";
import { SkillQuickRate } from "./skill-quick-rate";
import { SkillStatus } from "./skill-status";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/plural";

interface SkillCardProps {
  skill: Skill;
  canEdit?: boolean;
  canReview?: boolean;
  reviewPending?: boolean;
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
  onQuickRate: (skillId: string, level: SkillLevel) => void;
  onApprove?: (skill: Skill) => void;
  onReturn?: (skill: Skill) => void;
}

export function SkillCard({
  skill,
  canEdit = true,
  canReview = false,
  reviewPending = false,
  onViewDetails,
  onAssess,
  onQuickRate,
  onApprove,
  onReturn,
}: SkillCardProps) {
  const proof = skill.certifiedProof?.certificateName ?? skill.evidenceNote;
  const showReviewActions = canReview && skill.verification === "pending_review";

  return (
    <article
      data-slot="vault-card"
      data-verified={skill.verification === "certified" ? "true" : undefined}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-body font-semibold text-foreground">
          <button
            type="button"
            onClick={() => onViewDetails(skill)}
            className="rounded-xs text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {skill.name}
          </button>
        </h3>
        <SkillStatus status={skill.verification} className="shrink-0 pt-0.5" />
      </div>

      <p className="line-clamp-2 text-caption text-muted-foreground">{skill.description}</p>

      {skill.verification === "returned" && skill.reviewNote && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-caption text-destructive">
          Returned: {skill.reviewNote}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 rounded-md bg-muted/50 p-3">
        <p className="text-caption font-medium text-foreground">
          Level {skill.currentLevel} · {LEVEL_SCALE_GUIDE[skill.currentLevel].title}
        </p>
        {canEdit ? (
          <SkillQuickRate
            skillName={skill.name}
            currentLevel={skill.currentLevel}
            onRate={(level) => onQuickRate(skill.id, level)}
          />
        ) : (
          <p className="text-caption text-muted-foreground">{LEVEL_SCALE_GUIDE[skill.currentLevel].summary}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex min-w-0 flex-col text-caption text-muted-foreground">
          {proof && (
            <span className="flex min-w-0 items-center gap-1 text-foreground">
              {skill.certifiedProof && <Award className="size-3.5 shrink-0 text-primary" aria-hidden />}
              <span className="truncate">{proof}</span>
            </span>
          )}
          <span>
            {categoryLabel(skill.category)} · {pluralize(skill.yearsOfExperience, "year")}
          </span>
        </div>

        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label={`Edit ${skill.name}`}
            onClick={() => onAssess(skill)}
          >
            Edit
          </Button>
        ) : showReviewActions ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reviewPending}
              onClick={() => onReturn?.(skill)}
            >
              Return<span className="sr-only"> {skill.name}</span>
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={reviewPending}
              onClick={() => onApprove?.(skill)}
            >
              Approve<span className="sr-only"> {skill.name}</span>
            </Button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
