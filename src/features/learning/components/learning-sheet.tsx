"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { DateField } from "@/components/date-field";
import { EntityCombobox } from "@/components/entity-combobox";
import { FormSheet } from "@/components/form-sheet";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { RequiredMark } from "@/components/required-mark";
import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import type { ComboboxOption } from "@/components/entity-combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createLearningItem, updateLearningItem } from "@/features/learning/actions";
import { ProposeCourseDialog } from "@/features/learning/components/propose-course-dialog";
import { ProposeCertificateDialog } from "@/features/certificates/components/propose-certificate-dialog";
import { Button } from "@/components/ui/button";
import type { CourseOption, LearningRow } from "@/features/learning/queries";
import { learningSchema } from "@/features/learning/schema";
import { RECORD_STATUSES } from "@/features/records/schema";
import { formatDate } from "@/lib/format";

const STATUS_OPTIONS: SelectOption[] = RECORD_STATUSES.map((status) => ({ id: status, name: RECORD_STATUS_LABEL[status] }));

type FormValues = z.input<typeof learningSchema>;

/** Add or edit a learning item: a course, an exam being prepared for, or both (decision #72). */
export function LearningSheet({
  open,
  onOpenChange,
  editing,
  fixedMemberId,
  memberOptions = [],
  courses,
  examOptions,
  rows = [],
  presetTargetCertificateId,
  viewerMemberId = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: LearningRow | null;
  fixedMemberId?: string;
  memberOptions?: ComboboxOption[];
  courses: CourseOption[];
  examOptions: ComboboxOption[];
  /** Items the viewer can see, to warn about a second open item for the same thing. */
  rows?: LearningRow[];
  /** Exam to pre-select, e.g. when renewing an expiring certificate. */
  presetTargetCertificateId?: string;
  /** The signed-in member, who proposes a missing course; null for an admin. */
  viewerMemberId?: string | null;
}) {
  const [proposeName, setProposeName] = useState<string | null>(null);
  const [proposedCourses, setProposedCourses] = useState<CourseOption[]>([]);
  const [proposeExamOpen, setProposeExamOpen] = useState(false);
  const [proposedExams, setProposedExams] = useState<ComboboxOption[]>([]);
  const values = useMemo<FormValues>(
    () =>
      editing
        ? {
            memberId: editing.memberId,
            courseId: editing.courseId ?? "",
            targetCertificateId: editing.targetCertificateId ?? "",
            status: editing.status,
            progress: editing.progress,
            plannedDate: editing.plannedDate ? formatDate(editing.plannedDate) : "",
            finishedDate: editing.finishedDate ? formatDate(editing.finishedDate) : "",
            notes: editing.notes ?? "",
          }
        : {
            memberId: fixedMemberId ?? "",
            courseId: "",
            targetCertificateId: presetTargetCertificateId ?? "",
            status: "not_started",
            progress: 0,
            plannedDate: "",
            finishedDate: "",
            notes: "",
          },
    [editing, fixedMemberId, presetTargetCertificateId],
  );
  const form = useForm<FormValues, unknown, z.output<typeof learningSchema>>({ resolver: zodResolver(learningSchema), values });
  const errors = form.formState.errors;
  const [memberId, courseId, targetId, status] = useWatch({ control: form.control, name: ["memberId", "courseId", "targetCertificateId", "status"] });

  // Progress follows the status the way the database stores it.
  useEffect(() => {
    if (status === "not_started") form.setValue("progress", 0);
    if (status === "done") form.setValue("progress", 100);
  }, [status, form]);

  const duplicate = rows.find(
    (row) =>
      row.id !== editing?.id &&
      row.status !== "done" &&
      row.memberId === memberId &&
      (row.courseId ?? "") === (courseId ?? "") &&
      (row.targetCertificateId ?? "") === (targetId ?? "") &&
      Boolean(courseId || targetId),
  );

  const courseOptions = [...courses, ...proposedCourses].map(({ id, label, hint, catalogueStatus }) => ({
    id,
    label,
    hint: catalogueStatus === "pending" ? [hint, "awaiting admin approval"].filter(Boolean).join(" · ") : hint,
  }));

  async function onSubmit(input: z.output<typeof learningSchema>) {
    const result = editing ? await updateLearningItem({ ...input, id: editing.id }) : await createLearningItem(input);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? "Saved" : "Added to your learning");
    onOpenChange(false);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit learning" : "Add learning"}
      onSubmit={form.handleSubmit(onSubmit)}
      rootError={errors.root?.message}
      submitting={form.formState.isSubmitting}
    >
      <p className="text-caption text-muted-foreground">Pick a course, an exam, or both.</p>
      {!fixedMemberId && (
        <Field>
          <FieldLabel htmlFor="learning-member">
            Member
            <RequiredMark />
          </FieldLabel>
          <Controller
            control={form.control}
            name="memberId"
            render={({ field }) => (
              <EntityCombobox
                id="learning-member"
                value={field.value}
                onChange={field.onChange}
                options={memberOptions}
                placeholder="Choose a member"
                emptyText="No members found"
                disabled={!!editing}
              />
            )}
          />
          <FieldError errors={[errors.memberId]} />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="learning-course">Course</FieldLabel>
        <Controller
          control={form.control}
          name="courseId"
          render={({ field }) => (
            <EntityCombobox
              id="learning-course"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              options={courseOptions}
              placeholder="Choose a course (optional)"
              emptyText="No courses found"
              emptyAction={{ label: "Propose a new course", onClick: (query) => setProposeName(query ?? "") }}
            />
          )}
        />
        <FieldDescription>Leave empty when you study on your own.</FieldDescription>
        <FieldDescription className="flex flex-wrap items-center gap-1">
          Can&apos;t find the course?
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-caption" onClick={() => setProposeName("")}>
            + Propose a new course
          </Button>
        </FieldDescription>
        <FieldError errors={[errors.courseId]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="learning-exam">Exam you are preparing for</FieldLabel>
        <Controller
          control={form.control}
          name="targetCertificateId"
          render={({ field }) => (
            <EntityCombobox
              id="learning-exam"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              options={[...examOptions, ...proposedExams]}
              placeholder="Choose an exam (optional)"
              emptyText="No exams found"
              emptyAction={{ label: "Propose a new exam", onClick: () => setProposeExamOpen(true) }}
            />
          )}
        />
        <FieldDescription className="flex flex-wrap items-center gap-1">
          Can&apos;t find the exam?
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-caption" onClick={() => setProposeExamOpen(true)}>
            + Propose a new exam
          </Button>
        </FieldDescription>
        <FieldError errors={[errors.targetCertificateId]} />
      </Field>
      {duplicate && (
        <p role="alert" className="text-caption text-destructive">
          You already have an open item for this. Edit it instead.
        </p>
      )}
      <Field>
        <FieldLabel htmlFor="learning-status">
          Status
          <RequiredMark />
        </FieldLabel>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <OptionSelect id="learning-status" value={field.value} onChange={field.onChange} options={STATUS_OPTIONS} placeholder="Choose a status" />
          )}
        />
        <FieldError errors={[errors.status]} />
      </Field>
      {status === "in_progress" && (
        <Field>
          <FieldLabel htmlFor="learning-progress">Progress (%)</FieldLabel>
          <Input id="learning-progress" type="number" min={0} max={99} className="h-9" {...form.register("progress")} aria-invalid={!!errors.progress} />
          <FieldError errors={[errors.progress]} />
        </Field>
      )}
      {status !== "done" && (
        <Field>
          <Controller
            control={form.control}
            name="plannedDate"
            render={({ field }) => (
              <DateField
                id="learning-planned"
                label={targetId ? "Planned exam date" : "Planned finish date"}
                value={String(field.value ?? "")}
                onChange={field.onChange}
                invalid={!!errors.plannedDate}
              />
            )}
          />
          <FieldError errors={[errors.plannedDate]} />
        </Field>
      )}
      {status === "done" && (
        <Field>
          <Controller
            control={form.control}
            name="finishedDate"
            render={({ field }) => (
              <DateField
                id="learning-finished"
                label="Finished on"
                value={String(field.value ?? "")}
                onChange={field.onChange}
                invalid={!!errors.finishedDate}
                required
              />
            )}
          />
          <FieldError errors={[errors.finishedDate]} />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="learning-notes">Notes</FieldLabel>
        <Textarea id="learning-notes" rows={3} {...form.register("notes")} />
        <FieldError errors={[errors.notes]} />
      </Field>
      <ProposeCertificateDialog
        open={proposeExamOpen}
        onOpenChange={setProposeExamOpen}
        defaultKind="exam"
        defaultName=""
        onSuccess={(choice) => {
          setProposedExams((previous) => [...previous, { id: choice.id, label: choice.label, hint: choice.hint }]);
          form.setValue("targetCertificateId", choice.id, { shouldDirty: true });
          form.clearErrors(["courseId", "targetCertificateId"]);
        }}
      />
      {proposeName !== null && (
        <ProposeCourseDialog
          open
          onOpenChange={(next) => !next && setProposeName(null)}
          defaultName={proposeName}
          viewerMemberId={viewerMemberId}
          onCreated={(course) => {
            setProposedCourses((previous) => [...previous, course]);
            form.setValue("courseId", course.id, { shouldDirty: true });
            form.clearErrors("courseId");
          }}
        />
      )}
    </FormSheet>
  );
}
