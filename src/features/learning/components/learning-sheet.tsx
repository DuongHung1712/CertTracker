"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/** What the member works toward decides which field leads; an exam item may still name the course they prepare with. */
type Goal = "exam" | "course";
const GOALS: { goal: Goal; label: string; selfHint: string; teamHint: string }[] = [
  {
    goal: "exam",
    label: "An exam",
    selfHint: "A certification exam you will sit, such as HSK 1, AWS or PMP.",
    teamHint: "A certification exam the member will sit, such as HSK 1, AWS or PMP.",
  },
  {
    goal: "course",
    label: "A course",
    selfHint: "A course that gives a course certificate when you finish, with no exam to sit.",
    teamHint: "A course that gives a course certificate when finished, with no exam to sit.",
  },
];

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
  providers,
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
  /** Providers for the ProposeCertificateDialog dropdown. */
  providers?: { id: string; name: string }[];
}) {
  const [proposeName, setProposeName] = useState<string | null>(null);
  const [proposedCourses, setProposedCourses] = useState<CourseOption[]>([]);
  const [proposeExamOpen, setProposeExamOpen] = useState(false);
  const [proposedExams, setProposedExams] = useState<ComboboxOption[]>([]);
  // Keyed on the item being edited, so a reopened sheet starts from that item (or from an exam preset).
  const goalScope = `${editing?.id ?? "new"}|${presetTargetCertificateId ?? ""}`;
  const initialGoal: Goal = !editing || editing.targetCertificateId ? "exam" : "course";
  const [pickedGoal, setPickedGoal] = useState<{ scope: string; goal: Goal } | null>(null);
  // A closed sheet forgets the picked goal, so "Add learning" always starts from An exam.
  if (!open && pickedGoal) setPickedGoal(null);
  const goal = pickedGoal?.scope === goalScope ? pickedGoal.goal : initialGoal;
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

  // One open item per exam, whatever course prepares for it (DB: learning_items_one_open_per_exam);
  // a course-only item is one per course. A finished item never clashes.
  const openRows = rows.filter((row) => row.id !== editing?.id && row.status !== "done" && row.memberId === memberId);
  const duplicate =
    status === "done"
      ? undefined
      : openRows.find((row) =>
          targetId ? row.targetCertificateId === targetId : Boolean(courseId) && row.courseId === courseId && !row.targetCertificateId,
        );
  // Not a duplicate, but likely one goal tracked twice: the course is already its own item.
  // The sheet on one's own page (fixed member) or a manager picking themself speaks as "you".
  const forSelf = Boolean(fixedMemberId) || (Boolean(viewerMemberId) && memberId === viewerMemberId);
  const courseItem =
    !duplicate && targetId && courseId ? openRows.find((row) => row.courseId === courseId && !row.targetCertificateId) : undefined;

  const courseOptions = [...courses, ...proposedCourses].map(({ id, label, hint, catalogueStatus }) => ({
    id,
    label,
    hint: catalogueStatus === "pending" ? [hint, "awaiting admin approval"].filter(Boolean).join(" · ") : hint,
  }));

  function changeGoal(next: Goal) {
    if (next === goal) return;
    setPickedGoal({ scope: goalScope, goal: next });
    // A course item has no exam; an exam item keeps the course as the way the member prepares.
    if (next === "course") form.setValue("targetCertificateId", "", { shouldDirty: true });
    form.clearErrors(["courseId", "targetCertificateId"]);
  }

  const submit = form.handleSubmit(onSubmit);
  function handleSave(event: FormEvent<HTMLFormElement>) {
    if (goal === "exam" && !targetId) {
      event.preventDefault();
      form.setError("targetCertificateId", {
        message: forSelf ? "Choose the exam you are preparing for" : "Choose the exam the member is preparing for",
      });
      return;
    }
    if (duplicate) {
      event.preventDefault();
      return;
    }
    return submit(event);
  }

  // Closing for good starts the next Add or Edit from the saved values, not from what was typed and discarded.
  function close(next: boolean) {
    if (!next) form.reset(values);
    onOpenChange(next);
  }

  async function onSubmit(input: z.output<typeof learningSchema>) {
    const result = editing ? await updateLearningItem({ ...input, id: editing.id }) : await createLearningItem(input);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    toast.success(editing ? "Saved" : forSelf ? "Added to your learning" : "Added to learning");
    close(false);
  }

  const activeGoal = GOALS.find((choice) => choice.goal === goal);

  return (
    <>
    <FormSheet
      open={open}
      onOpenChange={close}
      title={editing ? "Edit learning" : "Add learning"}
      onSubmit={handleSave}
      rootError={errors.root?.message}
      submitting={form.formState.isSubmitting}
      submitDisabled={Boolean(duplicate)}
      dirty={form.formState.isDirty}
    >
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
        <FieldLabel id="learning-goal-label">{forSelf ? "What are you working toward?" : "What is the member working toward?"}</FieldLabel>
        <Tabs value={goal} onValueChange={(next) => changeGoal(next as Goal)}>
          <TabsList aria-labelledby="learning-goal-label" className="grid w-full grid-cols-2">
            {GOALS.map((choice) => (
              <TabsTrigger key={choice.goal} value={choice.goal}>
                {choice.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <FieldDescription>{forSelf ? activeGoal?.selfHint : activeGoal?.teamHint}</FieldDescription>
      </Field>
      {goal === "exam" && (
        <Field>
          <FieldLabel htmlFor="learning-exam">
            Exam
            <RequiredMark />
          </FieldLabel>
          <Controller
            control={form.control}
            name="targetCertificateId"
            render={({ field }) => (
              <EntityCombobox
                id="learning-exam"
                value={String(field.value ?? "")}
                onChange={field.onChange}
                options={[...examOptions, ...proposedExams]}
                placeholder="Choose an exam"
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
      )}
      <Field>
        <FieldLabel htmlFor="learning-course">
          Course
          {goal === "course" && <RequiredMark />}
        </FieldLabel>
        <Controller
          control={form.control}
          name="courseId"
          render={({ field }) => (
            <EntityCombobox
              id="learning-course"
              value={String(field.value ?? "")}
              onChange={field.onChange}
              options={courseOptions}
              placeholder={goal === "exam" ? "Self-study (no course)" : "Choose a course"}
              emptyText="No courses found"
              emptyAction={{ label: "Propose a new course", onClick: (query) => setProposeName(query ?? "") }}
            />
          )}
        />
        <FieldDescription>
          {goal === "exam"
            ? forSelf
              ? "The course you prepare with, if any. Leave empty for self-study."
              : "The course the member prepares with, if any. Leave empty for self-study."
            : forSelf
              ? "Add its certificate when you finish."
              : "Add its certificate when finished."}
        </FieldDescription>
        <FieldDescription className="flex flex-wrap items-center gap-1">
          Can&apos;t find the course?
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-caption" onClick={() => setProposeName("")}>
            + Propose a new course
          </Button>
        </FieldDescription>
        <FieldError errors={[errors.courseId && goal === "course" ? { message: "Choose a course" } : errors.courseId]} />
      </Field>
      {duplicate && (
        <p role="alert" className="text-caption text-destructive">
          {forSelf ? "You already have" : "This member already has"} an open item for {duplicate.targetCertificateName ?? duplicate.courseName}. Edit it instead.
        </p>
      )}
      {courseItem && (
        <p className="text-caption text-muted-foreground">
          {forSelf ? "You already track" : "This member already tracks"} {courseItem.courseName} as a course. Edit that item to add the exam, unless you want both certificates.
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
                label={goal === "exam" ? "Planned exam date" : "Planned finish date"}
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
    </FormSheet>
    <ProposeCertificateDialog
      open={proposeExamOpen}
      onOpenChange={setProposeExamOpen}
      defaultKind="exam"
      lockKind
      defaultName=""
      providers={providers}
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
    </>
  );
}
