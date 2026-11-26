"use client";

import * as React from "react";
import { Check, Undo2 } from "lucide-react";
import { LEVEL_SCALE_GUIDE, SKILL_LEVELS, updateSkillAssessmentSchema } from "../schema";
import type { Skill, SkillLevel } from "../types";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RequiredMark } from "@/components/required-mark";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
  onSave: (update: SkillAssessmentUpdate) => Promise<boolean> | boolean | void;
  onRemove?: (skillId: string) => Promise<boolean> | boolean | void;
}

function AssessmentForm({
  skill,
  onClose,
  onSave,
  onRemove,
  pending,
  setPending,
}: {
  skill: Skill;
  onClose: () => void;
  onSave: SkillAssessmentDialogProps["onSave"];
  onRemove?: SkillAssessmentDialogProps["onRemove"];
  pending: boolean;
  setPending: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [level, setLevel] = React.useState<SkillLevel>(skill.currentLevel);
  const [yearsInput, setYearsInput] = React.useState(String(skill.yearsOfExperience));
  const [note, setNote] = React.useState(skill.evidenceNote ?? "");
  const [yearsError, setYearsError] = React.useState<string | null>(null);
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const needsReview = LEVEL_SCALE_GUIDE[level].requiresReview;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = updateSkillAssessmentSchema.safeParse({
      skillId: skill.id,
      newLevel: level,
      yearsOfExperience: yearsInput,
      evidenceNote: note,
    });
    if (!parsed.success) {
      let nextYearsError: string | null = null;
      let nextNoteError: string | null = null;
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === "yearsOfExperience" && !nextYearsError) nextYearsError = issue.message;
        if (issue.path[0] === "evidenceNote" && !nextNoteError) nextNoteError = issue.message;
      }
      setYearsError(nextYearsError);
      setNoteError(nextNoteError);
      return;
    }

    setPending(true);
    try {
      const result = await onSave({
        skillId: skill.id,
        newLevel: level,
        yearsOfExperience: Math.round(parsed.data.yearsOfExperience * 10) / 10,
        evidenceNote: parsed.data.evidenceNote ?? "",
      });
      if (result !== false) onClose();
    } finally {
      setPending(false);
    }
  }

  async function handleConfirmRemove() {
    if (!onRemove) return;
    setRemoving(true);
    try {
      const result = await onRemove(skill.id);
      setConfirmRemove(false);
      if (result !== false) onClose();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        <p className="text-caption text-muted-foreground">* Required</p>

        {skill.verification === "returned" && skill.reviewNote && (
          <Alert variant="destructive">
            <Undo2 aria-hidden />
            <AlertDescription>
              Returned for changes: {skill.reviewNote}
              {/[.!?]$/.test(skill.reviewNote) ? "" : "."} Update your rating or note and save to send again.
            </AlertDescription>
          </Alert>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-label uppercase text-muted-foreground">
            Your level <RequiredMark />
          </legend>
          <div role="radiogroup" aria-label="Your level" aria-required="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SKILL_LEVELS.map((lvl) => {
              const info = LEVEL_SCALE_GUIDE[lvl];
              const selected = level === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={pending || removing}
                  onClick={() => setLevel(lvl)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left text-caption transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
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

        <Field data-invalid={!!yearsError}>
          <FieldLabel htmlFor="skill-years">
            Years using this skill at work <RequiredMark />
          </FieldLabel>
          <Input
            id="skill-years"
            type="number"
            min={0}
            max={50}
            step={0.5}
            aria-required="true"
            aria-invalid={!!yearsError}
            disabled={pending || removing}
            value={yearsInput}
            onChange={(e) => {
              setYearsInput(e.target.value);
              if (yearsError) setYearsError(null);
            }}
            className="h-9 w-32 tabular-nums"
          />
          <FieldError errors={yearsError ? [{ message: yearsError }] : []} />
        </Field>

        <Field data-invalid={!!noteError}>
          <FieldLabel htmlFor="skill-evidence">What have you done with it?</FieldLabel>
          <Textarea
            id="skill-evidence"
            rows={3}
            maxLength={1000}
            aria-invalid={!!noteError}
            disabled={pending || removing}
            placeholder="e.g. Moved the billing service to EKS with zero downtime"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (noteError) setNoteError(null);
            }}
            className="resize-none"
          />
          <FieldDescription>A project or result helps your manager trust the rating.</FieldDescription>
          <FieldError errors={noteError ? [{ message: noteError }] : []} />
        </Field>

        <DialogFooter className="sm:items-center">
          {skill.isSaved && onRemove && (
            <Button
              type="button"
              variant="destructive"
              className="sm:mr-auto"
              disabled={pending || removing}
              onClick={() => setConfirmRemove(true)}
            >
              Remove
            </Button>
          )}
          <Button type="button" variant="outline" disabled={pending || removing} onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || removing}>
            {pending ? "Saving…" : needsReview ? "Send for review" : "Save"}
          </Button>
        </DialogFooter>
      </form>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${skill.name} from your skills?`}
        description="Your rating, years of experience, and note for this skill will be removed from your profile."
        confirmLabel="Remove"
        pendingLabel="Removing…"
        pending={removing}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
}

export function SkillAssessmentDialog({ skill, onOpenChange, onSave, onRemove }: SkillAssessmentDialogProps) {
  const [pending, setPending] = React.useState(false);

  if (!skill) return null;

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle className="text-section-title">Rate {skill.name}</DialogTitle>
          <DialogDescription>Pick the level that fits today, then add how long and where you used it.</DialogDescription>
        </DialogHeader>
        <AssessmentForm
          key={skill.id}
          skill={skill}
          onClose={() => onOpenChange(false)}
          onSave={onSave}
          onRemove={onRemove}
          pending={pending}
          setPending={setPending}
        />
      </DialogContent>
    </Dialog>
  );
}
