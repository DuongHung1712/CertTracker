"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reviewMemberSkill } from "../actions";
import { reviewMemberSkillSchema } from "../schema";
import type { PendingSkillReview } from "../types";
import { PendingSkillReviewsSection } from "./skills-header";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RequiredMark } from "@/components/required-mark";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

export interface SkillReviewTarget {
  memberId: string;
  memberName: string;
  skillId: string;
  skillName: string;
}

interface SkillReviewDialogProps {
  target: SkillReviewTarget | null;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmReturn: (note: string) => Promise<boolean> | boolean | void;
}

/** Confirms returning a Level 5 skill request with a required feedback note. */
export function SkillReviewDialog({
  target,
  pending = false,
  onOpenChange,
  onConfirmReturn,
}: SkillReviewDialogProps) {
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [prevTarget, setPrevTarget] = React.useState(target);

  if (target !== prevTarget) {
    setPrevTarget(target);
    setNote("");
    setError(null);
  }

  async function handleConfirm() {
    if (!target) return;
    const parsed = reviewMemberSkillSchema.safeParse({
      memberId: target.memberId,
      skillId: target.skillId,
      decision: "return",
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Write what the member should fix.");
      return;
    }

    const ok = await onConfirmReturn(parsed.data.note ?? note.trim());
    if (ok !== false) onOpenChange(false);
  }

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !pending) onOpenChange(false);
      }}
      title={target ? `Return ${target.skillName} for ${target.memberName}?` : ""}
      description="The level drops to 4 and goes back to the member with your note until they submit Level 5 again."
      confirmLabel="Return"
      pendingLabel="Returning…"
      variant="default"
      pending={pending}
      onConfirm={handleConfirm}
    >
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="skill-return-note">
          What should the member fix?
          <RequiredMark />
        </FieldLabel>
        <Textarea
          id="skill-return-note"
          value={note}
          maxLength={1000}
          rows={3}
          aria-required="true"
          aria-invalid={!!error}
          disabled={pending}
          placeholder="Explain what evidence or depth is still needed for Level 5"
          onChange={(event) => {
            setNote(event.target.value);
            if (error) setError(null);
          }}
        />
        <FieldError errors={error ? [{ message: error }] : []} />
      </Field>
    </ConfirmDialog>
  );
}

/** Pending Level 5 queue shown when an unlinked Admin or Manager opens `/skills` without `?memberId`. */
export function UnlinkedPendingReviews({ initialReviews }: { initialReviews: PendingSkillReview[] }) {
  const router = useRouter();
  const [reviews, setReviews] = React.useState(initialReviews);
  const [prevInitialReviews, setPrevInitialReviews] = React.useState(initialReviews);
  const [reviewingKey, setReviewingKey] = React.useState<string | null>(null);
  const [returnTarget, setReturnTarget] = React.useState<SkillReviewTarget | null>(null);

  if (initialReviews !== prevInitialReviews) {
    setPrevInitialReviews(initialReviews);
    setReviews(initialReviews);
  }

  async function submitReview({
    memberId,
    skillId,
    skillName,
    decision,
    note,
  }: {
    memberId: string;
    skillId: string;
    skillName: string;
    decision: "approve" | "return";
    note?: string;
  }): Promise<boolean> {
    const key = `${memberId}:${skillId}`;
    setReviewingKey(key);
    try {
      const result = await reviewMemberSkill({ memberId, skillId, decision, note });
      if (!result.ok) {
        toast.error(result.error, { duration: Infinity });
        return false;
      }
      setReviews((prev) => prev.filter((item) => !(item.memberId === memberId && item.skillId === skillId)));
      toast.success(
        decision === "approve"
          ? `Approved ${skillName} at Level 5`
          : `Returned ${skillName} for changes`,
      );
      router.refresh();
      return true;
    } catch {
      toast.error("Could not save the review. Check your connection and try again.", { duration: Infinity });
      return false;
    } finally {
      setReviewingKey(null);
    }
  }

  return (
    <>
      <PendingSkillReviewsSection
        reviews={reviews}
        reviewingKey={reviewingKey}
        onApprove={(review) => {
          void submitReview({
            memberId: review.memberId,
            skillId: review.skillId,
            skillName: review.skillName,
            decision: "approve",
          });
        }}
        onReturn={(review) => {
          setReturnTarget({
            memberId: review.memberId,
            memberName: review.memberName,
            skillId: review.skillId,
            skillName: review.skillName,
          });
        }}
      />
      <SkillReviewDialog
        target={returnTarget}
        pending={
          returnTarget !== null && reviewingKey === `${returnTarget.memberId}:${returnTarget.skillId}`
        }
        onOpenChange={(open) => {
          if (!open) setReturnTarget(null);
        }}
        onConfirmReturn={(note) => {
          if (!returnTarget) return false;
          return submitReview({
            memberId: returnTarget.memberId,
            skillId: returnTarget.skillId,
            skillName: returnTarget.skillName,
            decision: "return",
            note,
          });
        }}
      />
    </>
  );
}
