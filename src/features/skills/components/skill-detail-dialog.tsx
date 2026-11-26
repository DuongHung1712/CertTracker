import { Award, ExternalLink, ShieldCheck, Undo2 } from "lucide-react";
import { categoryLabel } from "../metrics";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill } from "../types";
import { SkillStatus } from "./skill-status";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate, formatDateTimeVn } from "@/lib/format";
import { pluralize } from "@/lib/plural";

interface SkillDetailDialogProps {
  skill: Skill | null;
  canEdit?: boolean;
  canReview?: boolean;
  reviewPending?: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenAssess: (skill: Skill) => void;
  onApprove?: (skill: Skill) => void;
  onReturn?: (skill: Skill) => void;
}

function formatDisplayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  return formatDateTimeVn(value).slice(0, 10);
}

/** Everything behind one card: what the level means, what backs the rating, and review status. */
export function SkillDetailDialog({
  skill,
  canEdit = true,
  canReview = false,
  reviewPending = false,
  onOpenChange,
  onOpenAssess,
  onApprove,
  onReturn,
}: SkillDetailDialogProps) {
  if (!skill) return null;

  const current = LEVEL_SCALE_GUIDE[skill.currentLevel];
  const proof = skill.certifiedProof;
  const endorsedLevel5 = skill.verification === "certified" && skill.currentLevel === 5 && !proof;
  const showReviewActions = canReview && skill.verification === "pending_review";
  const proofMeta = proof
    ? [
        proof.issuer,
        proof.certificateCode || null,
        proof.verifiedDate ? `issued ${formatDisplayDate(proof.verifiedDate)}` : null,
        proof.expiryDate ? `valid until ${formatDisplayDate(proof.expiryDate)}` : "no expiry",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="text-section-title">{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        {skill.verification === "returned" && skill.reviewNote && (
          <Alert variant="destructive">
            <Undo2 aria-hidden />
            <AlertDescription>Returned for changes: {skill.reviewNote}</AlertDescription>
          </Alert>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-caption sm:grid-cols-3">
          <div>
            <dt className="text-label uppercase text-muted-foreground">{canEdit ? "Your level" : "Level"}</dt>
            <dd className="text-body font-semibold text-foreground">
              {skill.currentLevel} · {current.title}
            </dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted-foreground">Experience</dt>
            <dd className="text-body text-foreground">{pluralize(skill.yearsOfExperience, "year")}</dd>
            <dd className="text-muted-foreground">
              {skill.lastEvaluatedAt ? `Rated ${formatDisplayDate(skill.lastEvaluatedAt)}` : "Not rated yet"}
            </dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted-foreground">Status</dt>
            <dd>
              <SkillStatus status={skill.verification} />
            </dd>
            <dd className="text-muted-foreground">{categoryLabel(skill.category)}</dd>
          </div>
        </dl>

        <div className="rounded-md bg-muted/50 p-3 text-caption">
          <p className="font-medium text-foreground">What level {skill.currentLevel} means</p>
          <p className="text-muted-foreground">{current.criteria}</p>
        </div>

        <section className="flex flex-col gap-2 text-caption">
          <h3 className="text-label uppercase text-muted-foreground">Proof</h3>
          {proof ? (
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 gap-2">
                <Award className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{proof.certificateName}</p>
                  <p className="text-muted-foreground">{proofMeta}</p>
                </div>
              </div>
              {proof.credentialUrl && (
                <a
                  href={proof.credentialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                >
                  View certificate
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
          ) : endorsedLevel5 ? (
            <div className="flex items-start gap-2 rounded-md border border-primary/25 bg-primary/5 p-3 text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <p>
                Endorsed at Level 5 by {skill.reviewedByName ?? (canEdit ? "your manager" : "a manager")}
                {skill.reviewedAt ? ` on ${formatDisplayDate(skill.reviewedAt)}` : ""}.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              {canEdit
                ? "No certificate yet. When you add a matching certificate, this skill shows as certified."
                : "No linked certificate yet."}
            </p>
          )}
          {skill.evidenceNote && (
            <p className="text-foreground">
              <span className="text-muted-foreground">{canEdit ? "Your note: " : "Member note: "}</span>
              {skill.evidenceNote}
            </p>
          )}
        </section>

        {skill.recommendedCourses && skill.recommendedCourses.length > 0 && (
          <section className="flex flex-col gap-2 text-caption">
            <h3 className="text-label uppercase text-muted-foreground">Courses that help</h3>
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {skill.recommendedCourses.map((course) => (
                <li key={course.title} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{course.title}</p>
                    <p className="text-muted-foreground">
                      {course.provider} · {pluralize(course.durationHours, "hour")}
                    </p>
                  </div>
                  <span className="shrink-0 text-muted-foreground">Up to level {course.targetLevel}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {canEdit && (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onOpenAssess(skill);
              }}
            >
              Edit rating
            </Button>
          )}
          {showReviewActions && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={reviewPending}
                onClick={() => {
                  onOpenChange(false);
                  onReturn?.(skill);
                }}
              >
                Return
              </Button>
              <Button
                type="button"
                disabled={reviewPending}
                onClick={() => {
                  onOpenChange(false);
                  onApprove?.(skill);
                }}
              >
                Approve
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
