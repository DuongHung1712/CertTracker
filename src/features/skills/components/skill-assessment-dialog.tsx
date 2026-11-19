import * as React from "react";
import { Check, Send, ShieldCheck, Sparkles } from "lucide-react";
import { LEVEL_SCALE_GUIDE } from "../schema";
import type { Skill, SkillLevel } from "../types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SkillAssessmentDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAssessment: (updated: {
    skillId: string;
    newLevel: SkillLevel;
    yearsOfExperience: number;
    evidenceNote: string;
    isManagerReview: boolean;
  }) => void;
}

interface AssessmentFormProps {
  skill: Skill;
  onClose: () => void;
  onSaveAssessment: SkillAssessmentDialogProps["onSaveAssessment"];
}

function AssessmentForm({ skill, onClose, onSaveAssessment }: AssessmentFormProps) {
  const [selectedLevel, setSelectedLevel] = React.useState<SkillLevel>(skill.currentLevel);
  const [years, setYears] = React.useState<number>(skill.yearsOfExperience);
  const [note, setNote] = React.useState<string>(skill.evidenceNote || "");

  const isLevel5 = selectedLevel === 5;
  const levels: SkillLevel[] = [0, 1, 2, 3, 4, 5];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    onSaveAssessment({
      skillId: skill.id,
      newLevel: selectedLevel,
      yearsOfExperience: Math.max(0, years),
      evidenceNote: note.trim(),
      isManagerReview: isLevel5,
    });

    onClose();

    if (isLevel5) {
      toast.success(
        `Requested Level 5 (DC Master) review from DC Manager for ${skill.name}`,
      );
    } else {
      toast.success(
        `Updated ${skill.name} to Level ${selectedLevel} (${LEVEL_SCALE_GUIDE[selectedLevel].title})`,
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
      {/* Level Selection Radio Grid */}
      <div className="flex flex-col gap-2">
        <Label className="text-label uppercase text-muted-foreground font-semibold">
          Select Competency Level (0 to 5)
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {levels.map((lvl) => {
            const info = LEVEL_SCALE_GUIDE[lvl];
            const isSelected = selectedLevel === lvl;
            const isMaster = lvl === 5;

            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setSelectedLevel(lvl)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 ring-1 ring-primary shadow-xs"
                    : "border-border bg-card hover:bg-accent/40",
                  isMaster && isSelected && "border-primary bg-primary/15 ring-primary",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-caption font-bold text-foreground">
                    Level {lvl}
                  </span>
                  {isSelected && <Check className="size-3.5 text-primary" />}
                </div>
                <span className="text-[12px] font-semibold text-foreground">
                  {info.title}
                </span>
                <span className="text-[10px] text-muted-foreground line-clamp-1">
                  {info.summary}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Level 5 Manager Endorsement Notice */}
      {isLevel5 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-caption text-foreground">
          <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-foreground">
              DC Master Requires Manager Endorsement
            </span>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Submitting Level 5 marks this skill as &quot;Pending Manager Review&quot;. Your DC Manager will be notified to review and endorse this evaluation.
            </p>
          </div>
        </div>
      )}

      {/* Experience Years */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="yoe-input" className="text-label uppercase text-muted-foreground font-semibold">
          Years of Active Experience
        </Label>
        <Input
          id="yoe-input"
          type="number"
          min={0}
          max={40}
          step={0.5}
          value={years}
          onChange={(e) => setYears(parseFloat(e.target.value) || 0)}
          className="h-9 font-mono tabular-nums"
          required
        />
        <p className="text-[11px] text-muted-foreground">
          Total professional experience applying this skill in production systems.
        </p>
      </div>

      {/* Project Evidence & Context */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="evidence-note" className="text-label uppercase text-muted-foreground font-semibold">
          Evidence &amp; Project Description (Optional)
        </Label>
        <Textarea
          id="evidence-note"
          rows={3}
          placeholder="e.g. Led migration to AWS EKS; authored zero-downtime deployment pipelines; PR #412..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="resize-none text-caption"
        />
        <p className="text-[11px] text-muted-foreground">
          Mention production systems, architectural designs, or relevant achievements.
        </p>
      </div>

      <DialogFooter className="flex items-center justify-between gap-2 border-t border-border pt-4 sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          size="sm"
          className="flex items-center gap-1.5 font-medium"
        >
          {isLevel5 ? (
            <>
              <Send className="size-3.5" />
              <span>Request Manager Review</span>
            </>
          ) : (
            <>
              <ShieldCheck className="size-3.5" />
              <span>Save Assessment</span>
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SkillAssessmentDialog({
  skill,
  open,
  onOpenChange,
  onSaveAssessment,
}: SkillAssessmentDialogProps) {
  if (!skill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-h-[90vh] overflow-y-auto">
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
            Assess Competency: {skill.name}
          </DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            Update your self-assessed skill level or submit project evidence for promotion review.
          </DialogDescription>
        </DialogHeader>

        <AssessmentForm
          key={skill.id}
          skill={skill}
          onClose={() => onOpenChange(false)}
          onSaveAssessment={onSaveAssessment}
        />
      </DialogContent>
    </Dialog>
  );
}
