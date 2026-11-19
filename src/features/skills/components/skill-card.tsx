import * as React from "react";
import { Award, Clock, Info, ShieldCheck, UserCheck } from "lucide-react";
import type { Skill, SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillLevelBadge } from "./skill-level-badge";
import { SkillQuickRate } from "./skill-quick-rate";
import { Button } from "@/components/ui/button";
import { pluralize } from "@/lib/plural";
import { cn } from "@/lib/utils";

interface SkillCardProps {
  skill: Skill;
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
  onQuickRate?: (skillId: string, level: SkillLevel) => void;
}

export function SkillCard({
  skill,
  onViewDetails,
  onAssess,
  onQuickRate,
}: SkillCardProps) {
  const isCertified = skill.verification === "certified";
  const isPending = skill.verification === "pending_review";
  const hasProof = !!skill.certifiedProof;

  return (
    <div
      data-slot="vault-card"
      data-verified={isCertified ? "true" : undefined}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/50",
        "vault-card",
        isCertified && "vault-verified",
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Top Meta Line: Code & Category */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wide vault-mono-tag">
            {skill.code}
          </span>

          <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {skill.category.replace("_", " & ")}
          </span>
        </div>

        {/* Skill Title & Description */}
        <div className="flex flex-col gap-1">
          <h4>
            <button
              type="button"
              onClick={() => onViewDetails(skill)}
              className="text-left text-body font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-xs"
            >
              {skill.name}
            </button>
          </h4>
          <p className="text-caption text-muted-foreground line-clamp-2 leading-relaxed">
            {skill.description}
          </p>
        </div>

        {/* Competency Level Bar & 1-Click Quick-Rate */}
        <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5 flex flex-col gap-2">
          <SkillLevelBadge
            currentLevel={skill.currentLevel}
            targetLevel={skill.targetLevel}
            showSegments={!onQuickRate}
            size="sm"
          />
          {onQuickRate && (
            <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase font-semibold">
                  Quick-Rate:
                </span>
                <SkillLegendPopover align="start" side="top" />
              </div>
              <SkillQuickRate
                skillId={skill.id}
                skillName={skill.name}
                currentLevel={skill.currentLevel}
                targetLevel={skill.targetLevel}
                onRate={(lvl) => onQuickRate(skill.id, lvl)}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Verification Status & Proof Box */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <div className="flex items-center justify-between">
            {isCertified ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-primary">
                <span className="vault-live-dot vault-dot-emerald" aria-hidden="true" />
                <ShieldCheck className="size-3.5" />
                <span>CERTIFIED</span>
              </span>
            ) : isPending ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
                <span className="vault-live-dot vault-dot-amber" aria-hidden="true" />
                <Clock className="size-3.5" />
                <span>REVIEW PENDING</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-muted-foreground">
                <UserCheck className="size-3.5 text-muted-foreground" />
                <span>SELF-ASSESSED</span>
              </span>
            )}

            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {pluralize(skill.yearsOfExperience, "year")}
            </span>
          </div>

          {/* Certificate Title Line if Certified or Evidence Note fallback */}
          {hasProof && skill.certifiedProof ? (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground line-clamp-1">
              <Award className="size-3 shrink-0 text-primary" />
              <span className="truncate font-medium text-foreground">
                {skill.certifiedProof.certificateName}
              </span>
            </div>
          ) : skill.evidenceNote ? (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground line-clamp-1">
              <span className="truncate italic">
                {skill.evidenceNote}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onViewDetails(skill)}
          className="h-7 px-2 text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3.5 mr-1" />
          <span>Details</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAssess(skill)}
          className="h-7 px-2.5 text-caption font-medium hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
        >
          <span>Assess</span>
        </Button>
      </div>
    </div>
  );
}
