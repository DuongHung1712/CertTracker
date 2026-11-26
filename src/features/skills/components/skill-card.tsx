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
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
  onQuickRate: (skillId: string, level: SkillLevel) => void;
}

export function SkillCard({ skill, onViewDetails, onAssess, onQuickRate }: SkillCardProps) {
  const proof = skill.certifiedProof?.certificateName ?? skill.evidenceNote;

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
            className="rounded-xs text-left hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {skill.name}
          </button>
        </h3>
        <SkillStatus status={skill.verification} className="shrink-0 pt-0.5" />
      </div>

      <p className="line-clamp-2 text-caption text-muted-foreground">{skill.description}</p>

      <div className="mt-auto flex flex-col gap-2 rounded-md bg-muted/50 p-3">
        <p className="text-caption font-medium text-foreground">
          Level {skill.currentLevel} · {LEVEL_SCALE_GUIDE[skill.currentLevel].title}
        </p>
        <SkillQuickRate
          skillName={skill.name}
          currentLevel={skill.currentLevel}
          onRate={(level) => onQuickRate(skill.id, level)}
        />
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
        <Button type="button" variant="outline" className="shrink-0" aria-label={`Edit ${skill.name}`} onClick={() => onAssess(skill)}>
          Edit
        </Button>
      </div>
    </article>
  );
}
