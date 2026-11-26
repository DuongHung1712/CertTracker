"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
import { proposeCourse } from "@/features/learning/actions";
import type { CourseOption } from "@/features/learning/queries";

function ProposeCourseForm({
  defaultName,
  viewerMemberId,
  onCreated,
  onClose,
}: {
  defaultName: string;
  viewerMemberId: string | null;
  onCreated: (course: CourseOption) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(defaultName);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a course name");
      return;
    }
    setPending(true);
    const result = await proposeCourse({ name: trimmed, proposedProvider: provider.trim() || null, memberId: viewerMemberId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated({ id: result.data.id, label: trimmed, hint: provider.trim() || "Self-study", catalogueStatus: "pending" });
    onClose();
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Propose a new course</DialogTitle>
        <DialogDescription>An admin adds it to the catalogue. You can track it right away.</DialogDescription>
      </DialogHeader>
      <p className="text-caption text-muted-foreground">* Required</p>
      <Field>
        <FieldLabel htmlFor="propose-course-name">
          Course name
          <RequiredMark />
        </FieldLabel>
        <Input
          id="propose-course-name"
          aria-required
          aria-invalid={!!error && !name.trim()}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="propose-course-provider">Provider</FieldLabel>
        <Input
          id="propose-course-provider"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
          placeholder="e.g. Udemy, Coursera"
        />
        <FieldDescription>Leave empty for self-study.</FieldDescription>
      </Field>
      <FieldError errors={error ? [{ message: error }] : []} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || name.trim() === ""}>
          {pending ? "Proposing…" : "Propose"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A course missing from the catalogue: it waits for an admin, and the member can track it right away. */
export function ProposeCourseDialog({
  open,
  onOpenChange,
  defaultName,
  viewerMemberId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  /** Who proposes (RLS: a member proposes as themself); null for an admin, who may add courses directly. */
  viewerMemberId: string | null;
  onCreated: (course: CourseOption) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProposeCourseForm
            key={defaultName}
            defaultName={defaultName}
            viewerMemberId={viewerMemberId}
            onCreated={onCreated}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
