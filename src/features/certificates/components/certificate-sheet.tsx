"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FormSheet } from "@/components/form-sheet";
import { EntityCombobox } from "@/components/entity-combobox";
import { OptionSelect, type SelectOption } from "@/components/option-select";
import { RequiredMark } from "@/components/required-mark";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createCertificate, updateCertificate } from "@/features/certificates/actions";
import {
  CERTIFICATE_KIND_LABEL,
  CERTIFICATE_KIND_NOUN,
  certificateSheetTitle,
  CERTIFICATE_KINDS,
  certificateSchema,
  type CertificateInput,
} from "@/features/certificates/schema";

type Editing = (CertificateInput & { id: string }) | null;

const KIND_OPTIONS: SelectOption[] = CERTIFICATE_KINDS.map((kind) => ({ id: kind, name: CERTIFICATE_KIND_LABEL[kind] }));

const EMPTY: CertificateInput = {
  kind: "exam",
  name: "",
  certTypeId: "",
  providerId: "",
  level: "",
  validityMonths: null,
  url: null,
  courseId: null,
};

export function CertificateSheet({
  open,
  onOpenChange,
  editing,
  certTypes,
  providers,
  courses,
  hasCourses,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  certTypes: SelectOption[];
  providers: SelectOption[];
  /** Courses that can grant this completion: those that grant nothing yet, plus the current one when editing. */
  courses: SelectOption[];
  /** False when no course exists at all, so the empty picker can say to add one. */
  hasCourses: boolean;
}) {
  // Input and output types differ (defaults and preprocessing), so the three generics are explicit, as in course-sheet.
  const form = useForm<z.input<typeof certificateSchema>, unknown, CertificateInput>({
    resolver: zodResolver(certificateSchema),
    values: editing ?? EMPTY,
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });

  async function onSubmit(values: CertificateInput) {
    const result = editing ? await updateCertificate({ id: editing.id, ...values }) : await createCertificate(values);
    if (!result.ok) {
      form.setError("root", { message: result.error });
      return;
    }
    const noun = CERTIFICATE_KIND_NOUN[values.kind];
    toast.success(editing ? `Saved ${noun} ${values.name}` : `Added ${noun} ${values.name}`);
    onOpenChange(false);
    form.reset(EMPTY);
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={certificateSheetTitle(!!editing, kind)}
      onSubmit={form.handleSubmit(onSubmit)}
      rootError={errors.root?.message}
      submitting={isSubmitting}
    >
      <Field>
        <FieldLabel htmlFor="certificate-kind">
          Kind <RequiredMark />
        </FieldLabel>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <OptionSelect
              id="certificate-kind"
              value={field.value}
              onChange={field.onChange}
              options={KIND_OPTIONS}
              placeholder="Choose a kind"
              invalid={!!errors.kind}
            />
          )}
        />
        <FieldError errors={[errors.kind]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="certificate-name">
          Name <RequiredMark />
        </FieldLabel>
        <Input id="certificate-name" className="h-9" {...form.register("name")} aria-invalid={!!errors.name} />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="certificate-type">
          Certificate type <RequiredMark />
        </FieldLabel>
        <Controller
          control={form.control}
          name="certTypeId"
          render={({ field }) => (
            <OptionSelect
              id="certificate-type"
              value={field.value}
              onChange={field.onChange}
              options={certTypes}
              placeholder="Choose a certificate type"
              invalid={!!errors.certTypeId}
            />
          )}
        />
        <FieldError errors={[errors.certTypeId]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="certificate-provider">
          Provider <RequiredMark />
        </FieldLabel>
        <Controller
          control={form.control}
          name="providerId"
          render={({ field }) => (
            <OptionSelect
              id="certificate-provider"
              value={field.value}
              onChange={field.onChange}
              options={providers}
              placeholder="Choose a provider"
              invalid={!!errors.providerId}
            />
          )}
        />
        <FieldError errors={[errors.providerId]} />
      </Field>
      {kind === "completion" && (
        <Field>
          <FieldLabel htmlFor="certificate-course">
            Course <RequiredMark />
          </FieldLabel>
          <Controller
            control={form.control}
            name="courseId"
            render={({ field }) => (
              <EntityCombobox
                id="certificate-course"
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(id) => field.onChange(id || null)}
                options={courses.map((course) => ({ id: course.id, label: course.name }))}
                placeholder="Choose a course"
                emptyText={hasCourses ? "Every course already grants a completion." : "No courses yet. Add a course first."}
                aria-required
                aria-invalid={!!errors.courseId}
              />
            )}
          />
          <FieldError errors={[errors.courseId]} />
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="certificate-level">Level</FieldLabel>
        <Input id="certificate-level" className="h-9" {...form.register("level")} aria-invalid={!!errors.level} />
        <FieldError errors={[errors.level]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="certificate-validity">Validity (months)</FieldLabel>
        <Input
          id="certificate-validity"
          type="number"
          min={1}
          className="h-9"
          {...form.register("validityMonths")}
          aria-invalid={!!errors.validityMonths}
        />
        <FieldError errors={[errors.validityMonths]} />
      </Field>
      <Field>
        <FieldLabel htmlFor="certificate-url">Certificate link</FieldLabel>
        <Input id="certificate-url" type="url" className="h-9" {...form.register("url")} aria-invalid={!!errors.url} />
        <FieldError errors={[errors.url]} />
      </Field>
    </FormSheet>
  );
}
