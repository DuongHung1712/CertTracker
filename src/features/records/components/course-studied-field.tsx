"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { courseChoicesFor, type CertificateChoice, type SavedCourse, type StudyCourse } from "@/features/records/certificate-course";

/** A Base UI `Select` value must be a non-empty string, so "no course" is a sentinel, not "". */
const SELF_STUDY = "self-study";
const SELF_STUDY_LABEL = "None (self-study)";
const FIELD_ID = "record-course-studied";

/** Exam: pick one of the courses that prepare for it, or none. Completion: the granting course, read-only. */
export function CourseStudiedField({
  certificate,
  courses,
  saved,
  value,
  onChange,
}: {
  certificate: CertificateChoice | undefined;
  courses: StudyCourse[];
  /** The record being edited, so a course that no longer prepares for its certificate stays visible. */
  saved: SavedCourse | null;
  value: string;
  onChange: (courseId: string) => void;
}) {
  if (!certificate) return null;

  if (certificate.kind === "completion") {
    return (
      <Field>
        <FieldLabel htmlFor={FIELD_ID}>Course studied</FieldLabel>
        <Input id={FIELD_ID} readOnly className="h-9" value={certificate.grantingCourse?.name ?? ""} aria-describedby={`${FIELD_ID}-hint`} />
        <FieldDescription id={`${FIELD_ID}-hint`}>The course that grants this completion. It can&apos;t be changed.</FieldDescription>
      </Field>
    );
  }

  const choices = courseChoicesFor(courses, certificate.id, saved);
  const labelOf = (id: string) => (id === SELF_STUDY ? SELF_STUDY_LABEL : (choices.find((choice) => choice.id === id)?.label ?? SELF_STUDY_LABEL));
  return (
    <Field>
      <FieldLabel htmlFor={FIELD_ID}>Course studied</FieldLabel>
      <Select value={value || SELF_STUDY} onValueChange={(next) => next && onChange(next === SELF_STUDY ? "" : next)}>
        <SelectTrigger id={FIELD_ID}>
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
      {choices.length === 0 && <FieldDescription>No course prepares for this exam yet.</FieldDescription>}
    </Field>
  );
}
