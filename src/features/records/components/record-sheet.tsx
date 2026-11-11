"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { DateField } from "@/components/date-field";
import { EntityCombobox, type ComboboxOption } from "@/components/entity-combobox";
import { FileDropzone } from "@/components/file-dropzone";
import { RequiredMark } from "@/components/required-mark";
import { RECORD_STATUS_LABEL } from "@/components/status/labels";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createRecord, removeEvidence, updateRecord, uploadEvidence } from "@/features/records/actions";
import { courseAfterCertificateChange, type CertificateChoice, type StudyCourse } from "@/features/records/certificate-course";
import { CourseStudiedField } from "@/features/records/components/course-studied-field";
import type { RecordRow } from "@/features/records/queries";
import {
  RECORD_STATUSES,
  recordSchema,
  REFUND_STATUS_LABEL,
  REFUND_STATUSES,
  type RecordInput,
} from "@/features/records/schema";
import { valuesOnStatusChange, visibleFields } from "@/features/records/status-fields";
import { todayVn } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { EVIDENCE_ACCEPT, EVIDENCE_WRONG_TYPE_MESSAGE, MAX_EVIDENCE_BYTES, sniffEvidenceType } from "@/lib/storage/evidence";

type Editing = RecordRow | null;
type FormValues = z.input<typeof recordSchema>;

export function RecordSheet({
  open,
  onOpenChange,
  editing,
  memberOptions,
  certificateOptions,
  studyCourses,
  showCompanyFields,
  fixedMemberId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  memberOptions: ComboboxOption[];
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  /** False for role "member": those fields are then never registered nor sent (a DB trigger rejects them). */
  showCompanyFields: boolean;
  /** /me: the record always belongs to this member, so the picker is not rendered. */
  fixedMemberId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [removingEvidence, setRemovingEvidence] = useState(false);

  // `listMemberOptions` returns active members only; the member of the row being edited may be
  // inactive, and the (disabled) picker must still show their name.
  const members = useMemo(() => {
    if (!editing || memberOptions.some((option) => option.id === editing.memberId)) return memberOptions;
    return [{ id: editing.memberId, label: editing.memberName, hint: editing.memberCode }, ...memberOptions];
  }, [editing, memberOptions]);

  const values = useMemo<FormValues>(() => {
    if (editing) {
      return {
        memberId: editing.memberId,
        certificateId: editing.certificateId,
        courseId: editing.courseId ?? "",
        status: editing.status,
        progress: editing.progress,
        plannedExamDate: editing.plannedExamDate ? formatDate(editing.plannedExamDate) : "",
        issuedDate: editing.issuedDate ? formatDate(editing.issuedDate) : "",
        certificateUrl: editing.certificateUrl ?? "",
        notes: editing.notes ?? "",
        ...(showCompanyFields ? { viaCompany: editing.viaCompany, refundStatus: editing.refundStatus } : {}),
      };
    }
    return {
      memberId: fixedMemberId ?? "",
      certificateId: "",
      courseId: "",
      status: "not_started",
      progress: 0,
      plannedExamDate: "",
      issuedDate: "",
      certificateUrl: "",
      notes: "",
      ...(showCompanyFields ? { viaCompany: false, refundStatus: "n_a" as const } : {}),
    };
  }, [editing, fixedMemberId, showCompanyFields]);

  // `recordSchema` coerces/preprocesses several fields, so its input and output types diverge —
  // same three-generic form as course-sheet.tsx.
  const form = useForm<FormValues, unknown, RecordInput>({
    resolver: zodResolver(recordSchema),
    values,
    // A realtime refresh may change `editing` under an open sheet: fields the user has touched must survive.
    resetOptions: { keepDirtyValues: true },
  });

  // Every way of closing (Cancel, Esc, overlay, successful save) goes through here, so a reopened
  // sheet never shows stale edits or a leftover file.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // `resetOptions.keepDirtyValues` would otherwise carry over here and keep the discarded edits.
      form.reset(undefined, { keepDirtyValues: false });
      setFile(null);
      setFileError(null);
    }
    onOpenChange(nextOpen);
  }

  async function onSubmit(input: RecordInput) {
    // A rejected proof file must not leave a saved certificate behind; the error stays visible under the dropzone.
    if (fileError) return;
    if (file && !sniffEvidenceType(new Uint8Array(await file.slice(0, 16).arrayBuffer()))) {
      setFileError(EVIDENCE_WRONG_TYPE_MESSAGE);
      return;
    }

    let recordId: string;
    if (editing) {
      const result = await updateRecord({ id: editing.id, ...input, ...(showCompanyFields ? {} : { notes: undefined }) });
      if (!result.ok) {
        form.setError("root", { message: result.error });
        return;
      }
      recordId = editing.id;
    } else {
      const result = await createRecord(input);
      if (!result.ok) {
        form.setError("root", { message: result.error });
        return;
      }
      recordId = result.data.id;
    }

    let uploadError: string | null = null;
    if (file && input.status === "done") {
      const body = new FormData();
      body.set("recordId", recordId);
      body.set("file", file);
      const uploaded = await uploadEvidence(body);
      if (!uploaded.ok) uploadError = uploaded.error;
    }

    // The certificate is saved either way: staying open on "create" would hit the duplicate error on retry.
    handleOpenChange(false);
    if (uploadError) {
      toast.error(`The certificate is saved, but the evidence could not be uploaded: ${uploadError} Open "Edit" to try again.`, {
        duration: Infinity,
      });
    } else {
      toast.success(editing ? "Saved certificate" : "Added certificate");
    }
  }

  async function handleRemoveEvidence() {
    if (!editing) return;
    setRemovingEvidence(true);
    const result = await removeEvidence({ id: editing.id });
    setRemovingEvidence(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Removed evidence");
  }

  const errors = form.formState.errors;
  const status = useWatch({ control: form.control, name: "status" });
  const shown = visibleFields(status);
  const certificateId = useWatch({ control: form.control, name: "certificateId" });
  const courseId = useWatch({ control: form.control, name: "courseId" });
  const certificate = certificateOptions.find((option) => option.id === certificateId);

  function handleCertificateChange(nextId: string) {
    form.setValue("certificateId", nextId, { shouldDirty: true });
    const next = certificateOptions.find((option) => option.id === nextId);
    form.setValue("courseId", courseAfterCertificateChange(next, studyCourses, String(courseId ?? "")), { shouldDirty: true });
    form.clearErrors("certificateId");
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-section-title">{editing ? "Edit certificate" : "Add certificate"}</SheetTitle>
        </SheetHeader>
        <form
          noValidate
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <p className="text-caption text-muted-foreground">* Required</p>
          {!fixedMemberId && (
            <Field>
              <FieldLabel htmlFor="record-member">
                Member
                <RequiredMark />
              </FieldLabel>
              <Controller
                control={form.control}
                name="memberId"
                render={({ field }) => (
                  <EntityCombobox
                    id="record-member"
                    value={field.value}
                    onChange={field.onChange}
                    options={members}
                    placeholder="Choose a member"
                    emptyText="No members found"
                    disabled={!!editing}
                    aria-invalid={!!errors.memberId}
                    aria-required
                  />
                )}
              />
              <FieldError errors={[errors.memberId]} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="record-certificate">
              Certificate
              <RequiredMark />
            </FieldLabel>
            <EntityCombobox
              id="record-certificate"
              value={certificateId}
              onChange={handleCertificateChange}
              options={certificateOptions}
              placeholder="Choose a certificate"
              emptyText="No certificates found"
              aria-invalid={!!errors.certificateId}
              aria-required
              aria-describedby="record-certificate-hint"
            />
            <FieldDescription id="record-certificate-hint">Can&apos;t find your certificate? Ask your admin to add it.</FieldDescription>
            <FieldError errors={[errors.certificateId]} />
          </Field>
          <CourseStudiedField
            certificate={certificate}
            courses={studyCourses}
            saved={editing?.courseId ? { id: editing.courseId, name: editing.courseName ?? "", certificateId: editing.certificateId } : null}
            value={String(courseId ?? "")}
            onChange={(next) => form.setValue("courseId", next, { shouldDirty: true })}
          />
          <Field>
            <FieldLabel htmlFor="record-status">
              Status
              <RequiredMark />
            </FieldLabel>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(next) => {
                    if (!next) return;
                    field.onChange(next);
                    const change = valuesOnStatusChange(next, { progress: Number(form.getValues("progress")) });
                    form.setValue("progress", change.progress);
                    // Dirty, so a live update of the record cannot restore a value the user cleared.
                    for (const name of change.clear) form.setValue(name, "", { shouldDirty: true });
                    if (next !== "done") {
                      setFile(null);
                      setFileError(null);
                    }
                    form.clearErrors(["progress", ...change.clear]);
                  }}
                >
                  <SelectTrigger id="record-status" aria-invalid={!!errors.status} aria-required>
                    {/* Base UI's SelectValue renders the raw value by default; map it back to the label. */}
                    <SelectValue placeholder="Choose a status">
                      {(value: (typeof RECORD_STATUSES)[number]) => RECORD_STATUS_LABEL[value] ?? "Choose a status"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {RECORD_STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.status]} />
          </Field>
          {shown.progress && (
            <Field>
              <FieldLabel htmlFor="record-progress">
                Progress (%)
                <RequiredMark />
              </FieldLabel>
              <Input
                id="record-progress"
                type="number"
                min={0}
                max={100}
                className="h-9"
                {...form.register("progress")}
                aria-invalid={!!errors.progress}
                aria-required
              />
              <FieldError errors={[errors.progress]} />
            </Field>
          )}
          {shown.plannedExamDate && (
            <Field>
              <Controller
                control={form.control}
                name="plannedExamDate"
                render={({ field }) => (
                  <DateField
                    id="record-planned"
                    label="Planned exam date"
                    name={field.name}
                    value={String(field.value ?? "")}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    invalid={!!errors.plannedExamDate}
                  />
                )}
              />
              <FieldError errors={[errors.plannedExamDate]} />
            </Field>
          )}
          {shown.issuedDate && (
            <Field>
              <Controller
                control={form.control}
                name="issuedDate"
                render={({ field }) => (
                  <DateField
                    id="record-issued"
                    label="Issue date"
                    name={field.name}
                    value={String(field.value ?? "")}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    max={todayVn()}
                    invalid={!!errors.issuedDate}
                    required
                    describedBy="record-issued-hint"
                  />
                )}
              />
              <FieldDescription id="record-issued-hint">
                The day it was issued. The expiry date is worked out from its validity period.
              </FieldDescription>
              <FieldError errors={[errors.issuedDate]} />
            </Field>
          )}
          {shown.certificateUrl && (
            <Field>
              <FieldLabel htmlFor="record-url">Certificate link</FieldLabel>
              <Input
                id="record-url"
                type="url"
                className="h-9"
                {...form.register("certificateUrl")}
                aria-invalid={!!errors.certificateUrl}
              />
              <FieldError errors={[errors.certificateUrl]} />
            </Field>
          )}
          {showCompanyFields && (
            <>
              <Field orientation="horizontal">
                <FieldLabel htmlFor="record-via-company">Registered through the company</FieldLabel>
                <Controller
                  control={form.control}
                  name="viaCompany"
                  render={({ field }) => (
                    <Switch id="record-via-company" checked={field.value ?? false} onCheckedChange={field.onChange} />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="record-refund">Refund status</FieldLabel>
                <Controller
                  control={form.control}
                  name="refundStatus"
                  render={({ field }) => (
                    <Select value={field.value ?? "n_a"} onValueChange={field.onChange}>
                      <SelectTrigger id="record-refund" aria-invalid={!!errors.refundStatus}>
                        <SelectValue>
                          {(value: (typeof REFUND_STATUSES)[number]) => REFUND_STATUS_LABEL[value] ?? REFUND_STATUS_LABEL.n_a}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {REFUND_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {REFUND_STATUS_LABEL[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.refundStatus]} />
              </Field>
            </>
          )}
          {showCompanyFields && (
            <Field>
              <FieldLabel htmlFor="record-notes">Notes</FieldLabel>
              <Textarea id="record-notes" {...form.register("notes")} aria-invalid={!!errors.notes} />
              <FieldError errors={[errors.notes]} />
            </Field>
          )}
          {shown.evidence && (
            <Field>
              <FieldLabel htmlFor="record-evidence">Evidence</FieldLabel>
              <FileDropzone
                id="record-evidence"
                file={file}
                onChange={(next) => {
                  setFile(next);
                  setFileError(null);
                }}
                accept={EVIDENCE_ACCEPT}
                maxBytes={MAX_EVIDENCE_BYTES}
                onReject={setFileError}
              />
              {fileError && (
                <p role="alert" className="text-caption text-destructive">
                  {fileError}
                </p>
              )}
              {editing?.hasEvidence && (
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={`/api/records/${editing.id}/evidence`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body text-primary underline underline-offset-2"
                  >
                    View current evidence
                  </a>
                  <Button type="button" variant="ghost" size="sm" disabled={removingEvidence} onClick={handleRemoveEvidence}>
                    Remove evidence
                  </Button>
                </div>
              )}
            </Field>
          )}
          {errors.root && (
            <p role="alert" className="text-caption text-destructive">
              {errors.root.message}
            </p>
          )}
          <SheetFooter className="flex-row justify-end gap-2 px-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
