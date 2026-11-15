"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CertificateKind } from "@/features/certificates/schema";
import { courseChoicesFor, type CertificateChoice, type SavedCourse, type StudyCourse } from "@/features/records/certificate-course";

/** A Base UI `Select` value must be a non-empty string, so "no course" is a sentinel, not "". */
const SELF_STUDY = "self-study";
const SELF_STUDY_LABEL = "None (self-study)";
const FIELD_ID = "record-course-studied";
const LABEL_ID = `${FIELD_ID}-label`;
const HINT_ID = `${FIELD_ID}-hint`;

/**
 * Always shown, so a member learns that courses exist. Exam: pick one of the courses that prepare for it, or none.
 * Completion: the granting course, read-only.
 */
export function CourseStudiedField({
  kind,
  certificate,
  courses,
  saved,
  value,
  onChange,
}: {
  kind: CertificateKind;
  certificate: CertificateChoice | undefined;
  courses: StudyCourse[];
  /** The record being edited, so a course that no longer prepares for its certificate stays visible. */
  saved: SavedCourse | null;
  value: string;
  onChange: (courseId: string) => void;
}) {
  const label = (
    <FieldLabel id={LABEL_ID} htmlFor={kind === "completion" && certificate ? undefined : FIELD_ID}>
      Course studied
      {kind === "exam" && <span className="font-normal text-muted-foreground"> (optional)</span>}
    </FieldLabel>
  );

  if (!certificate) {
    return (
      <Field>
        {label}
        <Input id={FIELD_ID} disabled className="h-9" value="" aria-describedby={HINT_ID} />
        <FieldDescription id={HINT_ID}>{kind === "exam" ? "Choose the exam first." : "Choose the course completion first."}</FieldDescription>
      </Field>
    );
  }

  if (certificate.kind === "completion") {
    return (
      <Field>
        {label}
        {/* Plain text, not a disabled-looking input: it cannot be edited. */}
        <p id={FIELD_ID} aria-labelledby={LABEL_ID} aria-describedby={HINT_ID} className="min-w-0 text-body break-words">
          {certificate.grantingCourse?.name ?? "—"}
        </p>
        <FieldDescription id={HINT_ID}>The course that grants this completion. It can&apos;t be changed.</FieldDescription>
      </Field>
    );
  }

  const choices = courseChoicesFor(courses, certificate.id, saved);
  const none = choices.length === 0;
  const labelOf = (id: string) => (id === SELF_STUDY ? SELF_STUDY_LABEL : (choices.find((choice) => choice.id === id)?.label ?? SELF_STUDY_LABEL));
  return (
    <Field>
      {label}
      <Select value={value || SELF_STUDY} disabled={none} onValueChange={(next) => next && onChange(next === SELF_STUDY ? "" : next)}>
        <SelectTrigger id={FIELD_ID} aria-describedby={HINT_ID}>
          <SelectValue>{labelOf}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SELF_STUDY}>{SELF_STUDY_LABEL}</SelectItem>
          {choices.map((choice) => (
            <SelectItem key={choice.id} value={choice.id}>
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription id={HINT_ID}>
        {none ? "No course is listed for this exam. That's fine." : "Optional. Pick the course you used, if any."}
      </FieldDescription>
    </Field>
  );
}
