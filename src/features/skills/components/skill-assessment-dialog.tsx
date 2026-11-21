"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { LEVEL_SCALE_GUIDE, SKILL_LEVELS } from "../schema";
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

export interface SkillAssessmentUpdate {
  skillId: string;
  newLevel: SkillLevel;
  yearsOfExperience: number;
  evidenceNote: string;
}

interface SkillAssessmentDialogProps {
  skill: Skill | null;
  onOpenChange: (open: boolean) => void;
  onSave: (update: SkillAssessmentUpdate) => void;
}

function AssessmentForm({ skill, onClose, onSave }: { skill: Skill; onClose: () => void; onSave: SkillAssessmentDialogProps["onSave"] }) {
  const [level, setLevel] = React.useState<SkillLevel>(skill.currentLevel);
  const [years, setYears] = React.useState(skill.yearsOfExperience);
  const [note, setNote] = React.useState(skill.evidenceNote ?? "");
  const needsReview = LEVEL_SCALE_GUIDE[level].requiresReview;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ skillId: skill.id, newLevel: level, yearsOfExperience: Math.max(0, years), evidenceNote: note.trim() });
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label uppercase text-muted-foreground">Your level</legend>
        <div role="radiogroup" aria-label="Your level" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SKILL_LEVELS.map((lvl) => {
            const info = LEVEL_SCALE_GUIDE[lvl];
            const selected = level === lvl;
            return (
              <button
                key={lvl}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLevel(lvl)}
                className={cn(
                  "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left text-caption transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50",
                )}
              >
                <span className="flex w-full items-center justify-between font-medium text-foreground">
                  {lvl} · {info.title}
                  {selected && <Check className="size-3.5 text-primary" aria-hidden />}
                </span>
                <span className="line-clamp-2 text-muted-foreground">{info.officialLegend}</span>
              </button>
            );
          })}
        </div>
        {needsReview && (
          <p className="text-caption text-muted-foreground">
            Level 5 needs your manager&apos;s approval and shows as waiting for review.
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-years">Years using this skill at work</Label>
        <Input
          id="skill-years"
          type="number"
          min={0}
          max={50}
          step={0.5}
          value={years}
          onChange={(e) => setYears(Number.parseFloat(e.target.value) || 0)}
          className="w-32 tabular-nums"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-evidence">What have you done with it? (optional)</Label>
        <Textarea
          id="skill-evidence"
          rows={3}
          maxLength={1000}
          placeholder="e.g. Moved the billing service to EKS with zero downtime"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="resize-none"
        />
        <p className="text-caption text-muted-foreground">A project or result helps your manager trust the rating.</p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{needsReview ? "Send for review" : "Save"}</Button>
      </DialogFooter>
    </form>
  );
}

export function SkillAssessmentDialog({ skill, onOpenChange, onSave }: SkillAssessmentDialogProps) {
  if (!skill) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-section-title">Rate {skill.name}</DialogTitle>
          <DialogDescription>Pick the level that fits today, then add how long and where you used it.</DialogDescription>
        </DialogHeader>
        <AssessmentForm key={skill.id} skill={skill} onClose={() => onOpenChange(false)} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
