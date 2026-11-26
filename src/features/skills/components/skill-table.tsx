import { categoryLabel } from "../metrics";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill, SkillLevel } from "../types";
import { SkillLegendPopover } from "./skill-legend-popover";
import { SkillQuickRate } from "./skill-quick-rate";
import { SkillStatus } from "./skill-status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SkillTableProps {
  skills: Skill[];
  canEdit?: boolean;
  canReview?: boolean;
  reviewingSkillId?: string | null;
  onViewDetails: (skill: Skill) => void;
  onAssess: (skill: Skill) => void;
  onQuickRate: (skillId: string, level: SkillLevel) => void;
  onApprove?: (skill: Skill) => void;
  onReturn?: (skill: Skill) => void;
}

export function SkillTable({
  skills,
  canEdit = true,
  canReview = false,
  reviewingSkillId = null,
  onViewDetails,
  onAssess,
  onQuickRate,
  onApprove,
  onReturn,
}: SkillTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <Table className="text-table">
        <TableHeader>
          <TableRow>
            <TableHead>Skill</TableHead>
            <TableHead>
              <span className="inline-flex items-center gap-1">
                {canEdit ? "Your level" : "Level"}
                <SkillLegendPopover align="start" />
              </span>
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Proof</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {skills.map((skill) => {
            const showReviewActions = canReview && skill.verification === "pending_review";
            const reviewPending = reviewingSkillId === skill.id;
            return (
              <TableRow key={skill.id}>
                <TableCell className="max-w-xs">
                  <button
                    type="button"
                    onClick={() => onViewDetails(skill)}
                    className="block max-w-full truncate rounded-xs text-left font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {skill.name}
                  </button>
                  <span className="text-caption text-muted-foreground">{categoryLabel(skill.category)}</span>
                </TableCell>
                <TableCell>
                  {canEdit ? (
                    <SkillQuickRate
                      skillName={skill.name}
                      currentLevel={skill.currentLevel}
                      onRate={(level) => onQuickRate(skill.id, level)}
                    />
                  ) : (
                    <span className="whitespace-nowrap font-medium text-foreground">
                      {skill.currentLevel} · {LEVEL_SCALE_GUIDE[skill.currentLevel].title}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <SkillStatus status={skill.verification} />
                </TableCell>
                <TableCell className="max-w-56 text-muted-foreground">
                  <span className="block truncate">
                    {skill.certifiedProof?.certificateName ?? skill.evidenceNote ?? "—"}
                  </span>
                  {skill.verification === "returned" && skill.reviewNote && (
                    <span className="block truncate text-caption text-destructive">Returned: {skill.reviewNote}</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={`Edit ${skill.name}`}
                      onClick={() => onAssess(skill)}
                    >
                      Edit
                    </Button>
                  ) : showReviewActions ? (
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={reviewPending}
                        onClick={() => onReturn?.(skill)}
                      >
                        Return<span className="sr-only"> {skill.name}</span>
                      </Button>
                      <Button
                        type="button"
                        disabled={reviewPending}
                        onClick={() => onApprove?.(skill)}
                      >
                        Approve<span className="sr-only"> {skill.name}</span>
                      </Button>
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
