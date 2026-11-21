"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/required-mark";
import { proposeCourse } from "@/features/learning/actions";
import type { CourseOption } from "@/features/learning/queries";

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
  const [name, setName] = useState(defaultName);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const result = await proposeCourse({ name, proposedProvider: provider.trim() || null, memberId: viewerMemberId });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated({ id: result.data.id, label: name.trim(), hint: provider.trim() || "Self-study", catalogueStatus: "pending" });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Propose a new course</DialogTitle>
            <DialogDescription>An admin adds it to the catalogue. You can track it right away.</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="propose-course-name">
              Course name
              <RequiredMark />
            </FieldLabel>
            <Input id="propose-course-name" value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="propose-course-provider">Provider</FieldLabel>
            <Input id="propose-course-provider" value={provider} onChange={(event) => setProvider(event.target.value)} placeholder="Udemy, Coursera… (empty: self-study)" />
          </Field>
          {error && (
            <p role="alert" className="text-caption text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || name.trim() === ""}>
              {pending ? "Proposing…" : "Propose"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
