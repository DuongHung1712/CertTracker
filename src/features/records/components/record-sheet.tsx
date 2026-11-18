"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { DateField } from "@/components/date-field";
import { EntityCombobox, type ComboboxOption } from "@/components/entity-combobox";
import { FileDropzone } from "@/components/file-dropzone";
import { RequiredMark } from "@/components/required-mark";
import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CatalogueStatusBadge } from "@/components/status/record-status";
import { ProposeCertificateDialog } from "@/features/certificates/components/propose-certificate-dialog";
import { createRecord, deleteRecord, removeEvidence, updateRecord, uploadEvidence } from "@/features/records/actions";
import { courseAfterCertificateChange, type CertificateChoice, type StudyCourse } from "@/features/records/certificate-course";
import { CourseStudiedField } from "@/features/records/components/course-studied-field";
import { CERTIFICATE_KIND_NOUN, type CertificateKind } from "@/features/certificates/schema";
import { ADD_KIND_CHOICES, isRecordDeletableByMember, issuedDateHint, issuedDateLabel, plannedDateLabel, recordSavedMessage, recordSheetTitle, type ApprovalState } from "@/features/records/kind";
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

/** Storage RLS (`can_access_evidence`): the member, their managers and admins can read the file. */
const evidenceHint = (own: boolean): string =>
  `Upload a scan or screenshot (PDF/image up to ${MAX_EVIDENCE_BYTES / 1024 / 1024} MB). Only ${own ? "you, your managers" : "the member, their managers"} and admins can see it.`;
type FormValues = z.input<typeof recordSchema>;

export function RecordSheet({
  open,
  onOpenChange,
  editing,
  memberOptions,
  certificateOptions,
  studyCourses,
  showCompanyFields,
  canAddToCatalogue = false,
  fixedMemberId,
  presetStatus,
  presetCertificateId,
  records,
  onEditExisting,
  viewerMemberId = null,
  canDelete = false,
  providers,
}: {
  /** Rows the viewer can see: used to stop a second entry for the same member and certificate. */
  records?: RecordRow[];
  /** Opens the existing row in this sheet; shown with the duplicate message. */
  onEditExisting?: (record: RecordRow) => void;
  /** Opens an existing row with this status already chosen (the "Mark completed" shortcut); the user still fills the rest. */
  presetStatus?: RecordStatus;
  /** Pre-selects a certificate (e.g. initiating renewal for an expiring/expired certificate). */
  presetCertificateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Editing;
  memberOptions: ComboboxOption[];
  certificateOptions: CertificateChoice[];
  studyCourses: StudyCourse[];
  /** False for role "member": those fields are then never registered nor sent (a DB trigger rejects them). */
  showCompanyFields: boolean;
  /** Admin only: the catalogue is read-only for managers and members, so the hint links there for an admin alone. */
  canAddToCatalogue?: boolean;
  /** /me: the record always belongs to this member, so the picker is not rendered. */
  fixedMemberId?: string;
  /** The signed-in user's own member row: a reviewer editing their own item is treated as the member (the database does). */
  viewerMemberId?: string | null;
  /** Whether delete button is enabled (e.g. for drafts or admin/manager). */
  canDelete?: boolean;
  /** Providers for proposal dropdown. */
  providers?: { id: string; name: string }[];
}) {
  // Only a reviewer on someone else's item sees the reviewer wording.
  const isReviewer = showCompanyFields && !!editing && editing.memberId !== viewerMemberId;
  const [proposedCertificates, setProposedCertificates] = useState<CertificateChoice[]>([]);
  const localCertificates = useMemo(
    () => [...proposedCertificates, ...certificateOptions],
    [proposedCertificates, certificateOptions],
  );

  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeName, setProposeName] = useState("");

  const handleOpenPropose = (query?: string) => {
    setProposeName(query ? query.trim() : "");
    setProposeOpen(true);
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [removingEvidence, setRemovingEvidence] = useState(false);
  const [pickedKind, setPickedKind] = useState<{ scope: string; kind: CertificateKind } | null>(null);
  const rootErrorRef = useRef<HTMLParagraphElement>(null);
  /** The refund value typed before the company switch went off, restored when it goes back on. */
  const lastRefundRef = useRef<(typeof REFUND_STATUSES)[number]>("n_a");
  /** Progress typed while In progress, restored when the status comes back to it (null: use the saved row's). */
  const lastProgressRef = useRef<number | null>(null);

  // `listMemberOptions` returns active members only; the member of the row being edited may be
  // inactive, and the (disabled) picker must still show their name.
  const members = useMemo(() => {
    if (!editing || memberOptions.some((option) => option.id === editing.memberId)) return memberOptions;
    return [{ id: editing.memberId, label: editing.memberName, hint: editing.memberCode }, ...memberOptions];
  }, [editing, memberOptions]);

  const values = useMemo<FormValues>(() => {
    if (editing) {
      const preset = presetStatus && presetStatus !== editing.status ? valuesOnStatusChange(presetStatus, editing) : null;
      return {
        memberId: editing.memberId,
        certificateId: editing.certificateId,
        courseId: editing.courseId ?? "",
        status: presetStatus ?? editing.status,
        progress: preset?.progress ?? editing.progress,
        plannedExamDate: editing.plannedExamDate && !preset?.clear.includes("plannedExamDate") ? formatDate(editing.plannedExamDate) : "",
        issuedDate: editing.issuedDate ? formatDate(editing.issuedDate) : "",
        certificateUrl: editing.certificateUrl ?? "",
        notes: editing.notes ?? "",
        ...(showCompanyFields ? { viaCompany: editing.viaCompany, refundStatus: editing.refundStatus } : {}),
      };
    }
    return {
      memberId: fixedMemberId ?? "",
      certificateId: presetCertificateId ?? "",
      courseId: "",
      status: presetStatus ?? "not_started",
      progress: 0,
      plannedExamDate: "",
      issuedDate: "",
      certificateUrl: "",
      notes: "",
      ...(showCompanyFields ? { viaCompany: false, refundStatus: "n_a" as const } : {}),
    };
  }, [editing, fixedMemberId, showCompanyFields, presetStatus, presetCertificateId]);

  // `recordSchema` coerces/preprocesses several fields, so its input and output types diverge —
  // same three-generic form as course-sheet.tsx.
  const form = useForm<FormValues, unknown, RecordInput>({
    resolver: zodResolver(recordSchema),
    values,
    // A realtime refresh may change `editing` under an open sheet: fields the user has touched must survive.
    resetOptions: { keepDirtyValues: true },
  });

  // A new sheet or another record starts with no remembered values.
  useEffect(() => {
    lastProgressRef.current = null;
  }, [open, editing?.id]);

  // Every way of closing (Cancel, Esc, overlay, successful save) goes through here, so a reopened
  // sheet never shows stale edits or a leftover file.
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      // `resetOptions.keepDirtyValues` would otherwise carry over here and keep the discarded edits.
      form.reset(undefined, { keepDirtyValues: false });
      setPickedKind(null);
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
    let approval: ApprovalState | null;
    if (editing) {
      const result = await updateRecord({ id: editing.id, ...input, ...(showCompanyFields ? {} : { notes: undefined }) });
      if (!result.ok) {
        form.setError("root", { message: result.error });
        return;
      }
      recordId = editing.id;
      approval = result.data.approval;
    } else {
      const result = await createRecord(input);
      if (!result.ok) {
        form.setError("root", { message: result.error });
        return;
      }
      recordId = result.data.id;
      approval = result.data.approval;
    }

    let uploadError: string | null = null;
    if (file && input.status === "done") {
      const body = new FormData();
      body.set("recordId", recordId);
      body.set("file", file);
      const uploaded = await uploadEvidence(body);
      if (!uploaded.ok) uploadError = uploaded.error;
    }

    // The record is saved either way: staying open on "create" would hit the duplicate error on retry.
    handleOpenChange(false);
    if (uploadError) {
      toast.error(`The ${CERTIFICATE_KIND_NOUN[certificate?.kind ?? "exam"]} is saved, but the evidence could not be uploaded: ${uploadError} Open "Edit" to try again.`, {
        duration: Infinity,
      });
    } else {
      const saved = recordSavedMessage(!!editing, certificate?.kind);
      // The database decides (trigger), so say "waiting" only when it says so.
      toast.success(approval === "waiting" ? `${saved}. It is waiting for approval.` : saved);
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
  const memberId = useWatch({ control: form.control, name: "memberId" });
  const viaCompany = useWatch({ control: form.control, name: "viaCompany" });
  const refundStatus = useWatch({ control: form.control, name: "refundStatus" });
  // An import can leave a refund value on a row that is not company-registered: keep it editable so it can be cleared.
  const refundLocked = !viaCompany && (refundStatus ?? "n_a") === "n_a";
  const certificate = localCertificates.find((option) => option.id === certificateId);
  // The kind is a UI selector only (not a form field). A pick applies to this open sheet and record; otherwise it follows the record's certificate.
  const scope = `${open}|${editing?.id ?? ""}`;
  const kind: CertificateKind = pickedKind?.scope === scope ? pickedKind.kind : (certificate?.kind ?? editing?.certificateKind ?? "exam");
  const kindCertificates = localCertificates.filter((option) => option.kind === kind);

  const providersList = useMemo(() => {
    if (providers && providers.length > 0) return providers;
    // The providers of the catalogue entries already loaded, keyed by id: the proposal saves a provider id.
    const map = new Map<string, string>();
    for (const opt of localCertificates) {
      if (opt.providerId && opt.hint) map.set(opt.providerId, opt.hint);
    }
    return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [providers, localCertificates]);

  function handleProposeSuccess(choice: CertificateChoice) {
    setProposedCertificates((prev) => [choice, ...prev]);
    setPickedKind({ scope, kind: choice.kind });
    form.setValue("certificateId", choice.id, { shouldValidate: true, shouldDirty: true });
    handleCertificateChange(choice.id);
  }

  const canDeleteCurrent = canDelete || (editing ? isRecordDeletableByMember(editing) : false);

  async function handleDeleteRecord() {
    if (!editing) return;
    setDeleting(true);
    const result = await deleteRecord({ id: editing.id });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Deleted ${editing.certificateName}`);
    setConfirmDelete(false);
    handleOpenChange(false);
  }
  const targetMemberId = fixedMemberId ?? memberId;
  const activeExisting = records?.find(
    (record) => record.memberId === targetMemberId && record.certificateId === certificateId && record.status !== "done",
  );
  const doneDuplicates = records?.filter(
    (record) => record.memberId === targetMemberId && record.certificateId === certificateId && record.status === "done",
  );
  const formIssuedDate = useWatch({ control: form.control, name: "issuedDate" });

  const duplicate = editing || !certificateId
    ? undefined
    : status === "done"
      ? (activeExisting ?? doneDuplicates?.find((r) => r.issuedDate && r.issuedDate === formIssuedDate))
      : activeExisting;

  // A failed save is announced and focused, so a keyboard or screen-reader user lands on the reason.
  const rootError = errors.root?.message;
  // Keyed on `submitCount` too, so a second failure with the same message focuses it again.
  const submitCount = form.formState.submitCount;
  useEffect(() => {
    if (rootError) rootErrorRef.current?.focus();
  }, [rootError, submitCount]);

  // Switching to the existing row must load only its saved values: `keepDirtyValues` would otherwise
  // carry the Add form's certificate, course and file over, and Save would overwrite the row with them.
  function openExisting(record: RecordRow) {
    form.reset(undefined, { keepDirtyValues: false });
    setPickedKind(null);
    setFile(null);
    setFileError(null);
    onEditExisting?.(record);
  }

  function handleKindChange(next: CertificateKind) {
    if (next === kind) return;
    setPickedKind({ scope, kind: next });
    form.setValue("certificateId", "", { shouldDirty: true });
    form.setValue("courseId", courseAfterCertificateChange(undefined, studyCourses, ""), { shouldDirty: true });
    form.clearErrors("certificateId");
  }

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
          <SheetTitle className="text-section-title">{recordSheetTitle(!!editing, kind)}</SheetTitle>
        </SheetHeader>
        <form
          noValidate
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {editing?.approval === "returned" && (
            <Alert>
              <AlertDescription>
                {isReviewer ? "Returned to the member" : "Returned for changes"}: {editing.approvalNote}{/[.!?]$/.test(editing.approvalNote ?? "") ? "" : "."}
                {isReviewer ? " The member fixes it and saves to send it again." : " Fix it and save to send it again."}
              </AlertDescription>
            </Alert>
          )}
          <p className="text-caption text-muted-foreground">* Required</p>
          <Field>
            <FieldLabel id="record-kind-label">
              {editing ? "Kind" : "What are you adding?"}
              {!editing && <RequiredMark />}
            </FieldLabel>
            {editing ? (
              // Switching the kind of a saved record would change what it is, so Edit shows it read-only.
              <div>
                <Badge variant="secondary" className="rounded-sm" aria-labelledby="record-kind-label">
                  {ADD_KIND_CHOICES.find((choice) => choice.kind === kind)?.label}
                </Badge>
              </div>
            ) : (
              <Tabs value={kind} onValueChange={(next) => handleKindChange(next as CertificateKind)}>
                <TabsList aria-labelledby="record-kind-label" className="grid w-full grid-cols-2 group-data-horizontal/tabs:h-auto">
                  {ADD_KIND_CHOICES.map((choice) => (
                    <TabsTrigger key={choice.kind} value={choice.kind} className="px-2 whitespace-normal">
                      {choice.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}
            <FieldDescription>{ADD_KIND_CHOICES.find((choice) => choice.kind === kind)?.hint}</FieldDescription>
          </Field>
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
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="record-certificate">
                {kind === "exam" ? "Certificate" : "Course completion"}
                <RequiredMark />
              </FieldLabel>
              {certificate?.catalogueStatus && certificate.catalogueStatus !== "approved" && (
                <CatalogueStatusBadge status={certificate.catalogueStatus} />
              )}
            </div>
            <EntityCombobox
              id="record-certificate"
              value={certificateId}
              onChange={handleCertificateChange}
              options={kindCertificates}
              placeholder={kind === "exam" ? "Choose a certificate" : "Choose a completion"}
              emptyText={kind === "exam" ? "No certificates found" : "No course completions found"}
              emptyAction={{
                label: kind === "exam" ? "Propose a new certificate" : "Propose a new course completion",
                onClick: (query) => handleOpenPropose(query),
              }}
              aria-invalid={!!errors.certificateId}
              aria-required
              aria-describedby="record-certificate-hint"
            />
            {certificate?.catalogueStatus === "pending" && (
              <p className="text-caption text-amber-700 dark:text-amber-400">
                This item is pending admin approval. You can still save and track your progress.
              </p>
            )}
            {duplicate && (
              <div className="flex flex-wrap items-center gap-x-2 text-caption text-destructive">
                <p role="alert">{duplicate.certificateName} is already on this list. Edit it instead.</p>
                {onEditExisting && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => openExisting(duplicate)}>
                    Open it
                  </Button>
                )}
              </div>
            )}
            <FieldDescription id="record-certificate-hint">
              {canAddToCatalogue ? (
                <>
                  Can&apos;t find yours?{" "}
                  <Link href="/courses" className="underline underline-offset-2">
                    Add it in the Catalogue
                  </Link>
                  .
                </>
              ) : (
                <span className="flex flex-wrap items-center gap-1.5">
                  <span>Can&apos;t find yours?</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-caption font-medium text-primary underline underline-offset-2"
                    onClick={() => handleOpenPropose()}
                  >
                    + {kind === "exam" ? "Propose a new certificate" : "Propose a new course completion"}
                  </Button>
                </span>
              )}
            </FieldDescription>
            <FieldError errors={[errors.certificateId && kind === "completion" ? { ...errors.certificateId, message: "Choose a course completion" } : errors.certificateId]} />
          </Field>
          <CourseStudiedField
            kind={kind}
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
                    const previous = field.value;
                    field.onChange(next);
                    // Progress is forced while hidden; keep what was typed so coming back to In progress restores it.
                    if (previous === "in_progress") lastProgressRef.current = Number(form.getValues("progress"));
                    const typedProgress = previous === "in_progress" ? Number(form.getValues("progress")) : (lastProgressRef.current ?? editing?.progress ?? 0);
                    const change = valuesOnStatusChange(next, { progress: typedProgress });
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
            {!editing && kind === "exam" && (
              <FieldDescription>Already passed it? Choose Completed to add the date and your proof.</FieldDescription>
            )}
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
                    label={plannedDateLabel(kind)}
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
                    label={issuedDateLabel(kind)}
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
                {issuedDateHint(kind)}
              </FieldDescription>
              <FieldError errors={[errors.issuedDate]} />
            </Field>
          )}
          {shown.certificateUrl && (
            <Field>
              <FieldLabel htmlFor="record-url">{kind === "exam" ? "Certificate link" : "Course completion link"}</FieldLabel>
              <Input
                id="record-url"
                type="url"
                className="h-9"
                {...form.register("certificateUrl")}
                aria-invalid={!!errors.certificateUrl}
                aria-describedby="record-url-hint"
              />
              <FieldDescription id="record-url-hint">Link to the public badge or verification page.</FieldDescription>
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
                    <Switch
                      id="record-via-company"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        // Not registered through the company means nothing to refund: back to the default, and back to what was typed when switched on again.
                        if (!checked) {
                          lastRefundRef.current = form.getValues("refundStatus") ?? "n_a";
                          form.setValue("refundStatus", "n_a", { shouldDirty: true });
                        } else if (form.getValues("refundStatus") === "n_a") {
                          form.setValue("refundStatus", lastRefundRef.current, { shouldDirty: true });
                        }
                      }}
                    />
                  )}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="record-refund">Refund status</FieldLabel>
                <Controller
                  control={form.control}
                  name="refundStatus"
                  render={({ field }) => (
                    <Select value={field.value ?? "n_a"} onValueChange={field.onChange} disabled={refundLocked}>
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
                {refundLocked && <FieldDescription>Turn on Registered through the company to set this.</FieldDescription>}
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
              <FieldDescription id="record-evidence-hint">{evidenceHint(!showCompanyFields)}</FieldDescription>
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
            <p ref={rootErrorRef} tabIndex={-1} role="alert" className="text-caption text-destructive outline-none">
              {errors.root.message}
            </p>
          )}
          <SheetFooter className="flex-row items-center justify-between gap-2 px-0 pt-2 border-t border-border">
            {editing && canDeleteCurrent ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={deleting}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || !!duplicate}
              >
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
      <ProposeCertificateDialog
        open={proposeOpen}
        onOpenChange={setProposeOpen}
        defaultKind={kind}
        defaultName={proposeName}
        providers={providersList}
        onSuccess={handleProposeSuccess}
      />
      {editing && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${editing.certificateName}?`}
          description={`The ${CERTIFICATE_KIND_NOUN[editing.certificateKind]} and its evidence file will be deleted. This cannot be undone.`}
          confirmLabel={`Delete ${CERTIFICATE_KIND_NOUN[editing.certificateKind]}`}
          pendingLabel="Deleting…"
          pending={deleting}
          onConfirm={handleDeleteRecord}
        />
      )}
    </Sheet>
  );
}
