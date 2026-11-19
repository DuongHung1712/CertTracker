import * as React from "react";
import { Award, Calendar, Clock, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill } from "../types";
import { SkillLevelBadge } from "./skill-level-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";

interface SkillDetailDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAssess: (skill: Skill) => void;
}

export function SkillDetailDialog({
  skill,
  open,
  onOpenChange,
  onOpenAssess,
}: SkillDetailDialogProps) {
  if (!skill) return null;

  const currentLevelInfo = LEVEL_SCALE_GUIDE[skill.currentLevel];
  const targetLevelInfo = LEVEL_SCALE_GUIDE[skill.targetLevel];
  const isCertified = skill.verification === "certified";
  const hasProof = !!skill.certifiedProof;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="font-mono text-label uppercase text-muted-foreground vault-mono-tag">
              {skill.code}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium uppercase text-muted-foreground">
              {skill.category.replace("_", " & ")}
            </span>
          </div>
          <DialogTitle className="text-section-title font-semibold text-foreground">
            {skill.name}
          </DialogTitle>
          <DialogDescription className="text-body text-muted-foreground">
            {skill.description}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 py-2">
          {/* Level Status Box */}
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-label uppercase text-muted-foreground font-semibold">
                Competency Evaluation
              </span>
              <SkillLevelBadge
                currentLevel={skill.currentLevel}
                targetLevel={skill.targetLevel}
              />
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-2 sm:border-t-0 sm:pt-0 sm:text-right">
              <span className="text-label uppercase text-muted-foreground">Experience</span>
              <span className="font-mono text-body tabular-nums font-semibold text-foreground">
                {pluralize(skill.yearsOfExperience, "year")} in practice
              </span>
              <span className="text-[11px] text-muted-foreground">
                Evaluated: {formatDate(skill.lastEvaluatedAt)}
              </span>
            </div>
          </div>

          {/* Level Criteria Breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-label uppercase text-muted-foreground font-semibold">
                Current Level: {currentLevelInfo.title}
              </span>
              <p className="text-caption text-foreground leading-relaxed">
                {currentLevelInfo.criteria}
              </p>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/30 p-3">
              <span className="text-label uppercase text-muted-foreground font-semibold">
                Role Benchmark: {targetLevelInfo.title}
              </span>
              <p className="text-caption text-foreground leading-relaxed">
                {targetLevelInfo.criteria}
              </p>
            </div>
          </div>

          {/* Verification / Certified Proof Section */}
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-1.5 text-label uppercase font-semibold text-muted-foreground">
                {isCertified ? (
                  <>
                    <ShieldCheck className="size-4 text-primary" />
                    <span className="text-primary">Cryptographically Verified Proof</span>
                  </>
                ) : (
                  <>
                    <Award className="size-4 text-muted-foreground" />
                    <span>Evaluation Mode: Self-Assessed</span>
                  </>
                )}
              </span>

              {isCertified && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-primary">
                  <span className="vault-live-dot vault-dot-emerald" aria-hidden="true" />
                  CERTIFIED
                </span>
              )}
            </div>

            {hasProof && skill.certifiedProof ? (
              <div className="flex flex-col gap-2 pt-1 text-caption">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="font-semibold text-foreground">
                      {skill.certifiedProof.certificateName}
                    </h5>
                    <p className="text-muted-foreground">
                      Issued by {skill.certifiedProof.issuer} ({skill.certifiedProof.certificateCode})
                    </p>
                  </div>
                  {skill.certifiedProof.credentialUrl && (
                    <a
                      href={skill.certifiedProof.credentialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <span>Verify</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground" />
                    Verified: {formatDate(skill.certifiedProof.verifiedDate)}
                  </span>
                  {skill.certifiedProof.expiryDate ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3 text-muted-foreground" />
                      Valid through: {formatDate(skill.certifiedProof.expiryDate)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium">No expiry (Lifetime)</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1 text-caption text-muted-foreground pt-1">
                <p>
                  This skill is currently self-assessed. Completing an official certification or course in the catalogue will automatically upgrade its verification stamp to Certified.
                </p>
              </div>
            )}

            {skill.evidenceNote && (
              <div className="mt-2 rounded border border-border/70 bg-muted/40 p-2.5 text-caption">
                <span className="font-semibold text-foreground">Project Evidence / Notes:</span>
                <p className="mt-0.5 text-muted-foreground leading-relaxed">
                  {skill.evidenceNote}
                </p>
              </div>
            )}
          </div>

          {/* Recommended Next Courses */}
          {skill.recommendedCourses && skill.recommendedCourses.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-label uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-primary" />
                Recommended Next Courses
              </span>
              <div className="flex flex-col gap-2">
                {skill.recommendedCourses.map((crs, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-col">
                      <span className="text-caption font-semibold text-foreground">
                        {crs.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {crs.provider} · {pluralize(crs.durationHours, "study hour")} · Target: Level {crs.targetLevel}
                      </span>
                    </div>
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary shrink-0">
                      Level {crs.targetLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border pt-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              onOpenAssess(skill);
            }}
            className="flex items-center gap-1.5 font-medium"
          >
            Update Level Assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
