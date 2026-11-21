import { Award, ExternalLink } from "lucide-react";
import { categoryLabel } from "../metrics";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill } from "../types";
import { SkillStatus } from "./skill-status";
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
  onOpenChange: (open: boolean) => void;
  onOpenAssess: (skill: Skill) => void;
}

/** Everything behind one card: what the level means, what backs the rating, and what to study next. */
export function SkillDetailDialog({ skill, onOpenChange, onOpenAssess }: SkillDetailDialogProps) {
  if (!skill) return null;

  const current = LEVEL_SCALE_GUIDE[skill.currentLevel];
  const proof = skill.certifiedProof;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-section-title">{skill.name}</DialogTitle>
          <DialogDescription>{skill.description}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-caption sm:grid-cols-3">
          <div>
            <dt className="text-label uppercase text-muted-foreground">Your level</dt>
            <dd className="text-body font-semibold text-foreground">
              {skill.currentLevel} · {current.title}
            </dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted-foreground">Experience</dt>
            <dd className="text-body text-foreground">{pluralize(skill.yearsOfExperience, "year")}</dd>
            <dd className="text-muted-foreground">Rated {formatDate(skill.lastEvaluatedAt)}</dd>
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
                  <p className="text-muted-foreground">
                    {proof.issuer} · {proof.certificateCode} · issued {formatDate(proof.verifiedDate)} ·{" "}
                    {proof.expiryDate ? `valid until ${formatDate(proof.expiryDate)}` : "no expiry"}
                  </p>
                </div>
              </div>
              {proof.credentialUrl && (
                <a
                  href={proof.credentialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                >
                  Check credential
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              No certificate yet. When you add a matching certificate, this skill shows as certified.
            </p>
          )}
          {skill.evidenceNote && (
            <p className="text-foreground">
              <span className="text-muted-foreground">Your note: </span>
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
          <Button
            type="button"
            onClick={() => {
              onOpenChange(false);
              onOpenAssess(skill);
            }}
          >
            Edit rating
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
