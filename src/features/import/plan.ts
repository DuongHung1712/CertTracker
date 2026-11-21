import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";
import {
  cellText, detectProgressMode, IMPORT_FIELD_LABEL, IMPORT_FIELDS, normalizeBoolean, normalizeEmail, normalizeName, normalizeNotes, normalizeRefund,
  normalizeRecordType, normalizeStatus, normalizeUrl, parseCost, parseCurrency, parseImportDate, parseStudyHours, parseValidityMonths, progressToPercent,
  type Cell, type Cleaned, type ImportField, type ImportRecordType, type ImportTable, type ProgressMode,
} from "@/features/import/clean";
import { recordRuleIssues, type RefundStatus } from "@/features/records/schema";
import type { Currency } from "@/lib/money";
import { foldText } from "@/lib/text";

/* ---------------------------------------------------------------- types */

export type ExistingRecord = {
  id: string; memberId: string; certificateId: string; courseId: string | null; status: RecordStatus; progress: number;
  plannedExamDate: string | null; issuedDate: string | null; certificateUrl: string | null;
  viaCompany: boolean; refundStatus: RefundStatus; notes: string | null;
};

/** An open (not done) learning item: an import row updates the one with the same member, course and exam target. */
export type ExistingLearningItem = {
  id: string; memberId: string; courseId: string | null; targetCertificateId: string | null; status: RecordStatus; progress: number;
  plannedDate: string | null; finishedDate: string | null; notes: string | null;
};

export type ImportRowKind = ImportRecordType;

/** Decision #72: an explicit Record type wins; otherwise a Completed row is a certificate and anything else a learning item. */
export const routeImportRow = (row: { recordType: ImportRecordType | null; status: RecordStatus }): ImportRowKind =>
  row.recordType ?? (row.status === "done" ? "certificate" : "learning");

export type ImportLookups = {
  members: { id: string; email: string; fullName: string; teamId: string | null; isActive: boolean }[];
  teams: { id: string; name: string }[];
  providers: { id: string; name: string }[];
  certTypes: { id: string; name: string }[];
  certificates: {
    id: string; name: string; providerId: string | null; certTypeId: string | null; validityMonths: number | null;
    cost: number | null; costCurrency: Currency | null; estHours: number | null;
    /** A course certificate's granting course (certificates.course_id); absent or null for an exam. */
    grantsCourseId?: string | null;
  }[];
  /** Courses a record can name as the course studied; "grantsId" is the completion a course grants. */
  studyCourses: {
    id: string; name: string; preparesForId: string | null; grantsId: string | null;
    cost: number | null; costCurrency: Currency | null; estHours: number | null;
  }[];
  records: ExistingRecord[];
  learningItems: ExistingLearningItem[];
};

export type Ref = { id: string } | { name: string };
type MemberRef = { id: string } | { email: string; fullName: string; teamId: string | null };
type NewCertificateRef = {
  name: string; provider: Ref; certType: Ref | null; validityMonths: number | null;
  cost: number | null; costCurrency: Currency | null; estHours: number | null;
};
type CertificateRef = { id: string } | NewCertificateRef;
type NormalizedRecord = {
  status: RecordStatus; progress: number;
  plannedExamDate: string | null; issuedDate: string | null; certificateUrl: string | null;
  viaCompany: boolean | null; refundStatus: RefundStatus | null; notes: string | null;
};

/**
 * The `normalized` JSON contract that `commit_import` consumes (migration 20261111000001). The key stays `course`
 * because stored batches use it; the value is a certificate. Cost, currency or hours on a new one make the commit
 * also create the self-preparing course studied; `courseStudied` names an existing course instead.
 */
export type NormalizedRow = {
  /** Absent in batches stored before decision #72: a certificate. A learning row's `course` is its exam target (or null). */
  kind?: ImportRowKind;
  member: MemberRef;
  course: CertificateRef | null;
  courseStudied?: { id: string };
  record: NormalizedRecord;
};

export type PlannedRow = {
  rowNumber: number;
  raw: { cells: Record<string, Cell>; email: string | null; course: string | null };
  normalized: NormalizedRow | null;
  action: "create" | "update" | "skip";
  errors: string[];
  warnings: string[];
};

export type ImportPlan = {
  rows: PlannedRow[];
  notes: string[];
  newEntities: { members: string[]; providers: string[]; certTypes: string[]; certificates: string[]; courses: string[] };
};

type Issues = { errors: string[]; warnings: string[] };
type RowCells = Record<ImportField, Cell>;

/** "Issued date: ..." — every column message starts with the column's header. */
const inColumn = (ctx: PlanContext, field: ImportField, message: string): string =>
  `${ctx.headers[field] ?? IMPORT_FIELD_LABEL[field]}: ${message}`;

/* ------------------------------------------------------------ reconcile */

type ReconcileInput = { status: RecordStatus | null; progress: number | null; issuedDate: string | null };
type Reconciled = { status: RecordStatus; progress: number; errors: string[]; warnings: string[] };

/** Decision #22: status wins over progress; every correction leaves a warning. `existing` supplies a known issue date and progress. */
export function reconcileRecord(
  input: ReconcileInput,
  existing: Pick<ExistingRecord, "status" | "progress" | "issuedDate"> | null,
  today: string,
  column: (field: "progress" | "issuedDate", message: string) => string = (_field, message) => message,
): Reconciled {
  const warnings: string[] = [];
  const issuedDate = input.issuedDate ?? existing?.issuedDate ?? null;
  let { status, progress } = input;

  if (status === null && progress === null) {
    if (!existing) return { status: "not_started", progress: 0, errors: ["Status and progress are missing"], warnings };
    ({ status, progress } = existing);
  } else if (status === null) {
    const value = progress as number;
    status = value === 0 ? "not_started" : "in_progress"; // 100 is settled by alignWithStatus (done or 99%)
    if (value !== 100) warnings.push("Status taken from progress");
  } else if (progress === null) {
    progress = deriveProgress(status, existing, warnings);
  }

  const aligned = alignWithStatus(status, progress as number, issuedDate !== null, warnings);
  const errors = recordRuleIssues({ ...aligned, issuedDate }, today).map((issue) => column(issue.path, issue.message));
  return { ...aligned, errors, warnings };
}

function deriveProgress(status: RecordStatus, existing: Pick<ExistingRecord, "status" | "progress" | "issuedDate"> | null, warnings: string[]): number {
  if (status === "done") return 100;
  if (status === "not_started") return 0;
  if (existing?.status === "in_progress") return existing.progress;
  warnings.push("No progress given — set to 0%");
  return 0;
}

function alignWithStatus(
  status: RecordStatus,
  progress: number,
  hasIssuedDate: boolean,
  warnings: string[],
): { status: RecordStatus; progress: number } {
  if (status === "done" && progress !== 100) {
    warnings.push(`Status ${RECORD_STATUS_LABEL.done}: progress set to 100% (the file says ${progress}%)`);
    return { status, progress: 100 };
  }
  if (status === "not_started" && progress > 0) {
    const next: RecordStatus = progress === 100 ? "done" : "in_progress";
    warnings.push(`Progress is ${progress}% — status changed to ${RECORD_STATUS_LABEL[next]}`);
    return { status: next, progress };
  }
  if (status === "in_progress" && progress === 100) {
    if (hasIssuedDate) {
      warnings.push(`Progress is 100% — status changed to ${RECORD_STATUS_LABEL.done}`);
      return { status: "done", progress };
    }
    warnings.push("Progress is 100% but there is no issue date — set to 99%");
    return { status, progress: 99 };
  }
  return { status, progress };
}

/* -------------------------------------------------------------- context */

type FirstNewMember = { ref: { email: string; fullName: string; teamId: string | null }; rowNumber: number };
type FirstNewCertificate = { ref: NewCertificateRef; rowNumber: number };

/** Lookup indexes plus the "first definition wins" state shared by every row of one plan. */
type PlanContext = {
  /** The file's own header text per field, so a message names the column the person sees. */
  headers: Partial<Record<ImportField, string>>;
  today: string;
  date1904: boolean;
  progressMode: ProgressMode;
  membersByEmail: Map<string, ImportLookups["members"][number]>;
  teamsByName: Map<string, ImportLookups["teams"]>;
  providersByName: Map<string, { id: string }>;
  certTypesByName: Map<string, { id: string }>;
  certTypeNameById: Map<string, string>;
  certificatesByName: Map<string, ImportLookups["certificates"]>;
  studyCoursesByName: Map<string, ImportLookups["studyCourses"]>;
  recordsByKey: Map<string, ExistingRecord>;
  learningByKey: Map<string, ExistingLearningItem>;
  grantsCourseByCertificate: Map<string, string>;
  newMembers: Map<string, FirstNewMember>;
  newProviders: Map<string, string>;
  newCertTypes: Map<string, string>;
  newCertificates: Map<string, FirstNewCertificate>;
  seenRecords: Map<string, number>;
};

// One open item per exam whatever its course; a course-only item per course (migration 20261120000010).
const learningKey = (memberId: string, courseId: string | null, targetId: string | null): string =>
  targetId ? `${memberId}||${targetId}` : `${memberId}|${courseId ?? ""}|`;

/**
 * A member can hold several records of one certificate (renewals). The sheet has one row per member and
 * certificate, so it updates one record: the active attempt, else the latest Completed one. commit_import
 * (migration 20261118000004) orders the same way, so the preview and the commit name the same record.
 */
export function preferredRecords(records: ExistingRecord[]): Map<string, ExistingRecord> {
  const rank = (r: ExistingRecord) => [r.status === "done" ? 0 : 1, r.issuedDate ?? "", r.id] as const;
  const better = (a: ExistingRecord, b: ExistingRecord) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] !== y[0] ? x[0] > y[0] : x[1] !== y[1] ? x[1] > y[1] : x[2] > y[2];
  };
  const byKey = new Map<string, ExistingRecord>();
  for (const record of records) {
    const key = `${record.memberId}|${record.certificateId}`;
    const current = byKey.get(key);
    if (!current || better(record, current)) byKey.set(key, record);
  }
  return byKey;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

function firstByName<T extends { id: string; name: string }>(items: T[]): Map<string, { id: string }> {
  const map = new Map<string, { id: string }>();
  for (const item of items) if (!map.has(foldText(item.name))) map.set(foldText(item.name), { id: item.id });
  return map;
}

function createContext(table: ImportTable, lookups: ImportLookups, today: string): PlanContext {
  const progressColumn = table.map.progress;
  return {
    headers: Object.fromEntries(
      IMPORT_FIELDS.flatMap((field) => {
        const column = table.map[field];
        return column === undefined || !table.headers[column] ? [] : [[field, table.headers[column]]];
      }),
    ),
    today,
    date1904: table.date1904,
    progressMode: progressColumn === undefined ? "percent" : detectProgressMode(table.rows.map((row) => row.cells[progressColumn])),
    membersByEmail: new Map(lookups.members.map((member) => [member.email.toLowerCase(), member])),
    teamsByName: groupBy(lookups.teams, (team) => foldText(team.name)),
    providersByName: firstByName(lookups.providers),
    certTypesByName: firstByName(lookups.certTypes),
    certTypeNameById: new Map(lookups.certTypes.map((certType) => [certType.id, certType.name])),
    certificatesByName: groupBy(lookups.certificates, (certificate) => foldText(certificate.name)),
    studyCoursesByName: groupBy(lookups.studyCourses, (course) => foldText(course.name)),
    recordsByKey: preferredRecords(lookups.records),
    grantsCourseByCertificate: new Map(
      lookups.certificates.flatMap((c) => (c.grantsCourseId ? [[c.id, c.grantsCourseId] as const] : [])),
    ),
    learningByKey: new Map(
      lookups.learningItems.filter((item) => item.status !== "done").map((item) => [learningKey(item.memberId, item.courseId, item.targetCertificateId), item]),
    ),
    newMembers: new Map(),
    newProviders: new Map(),
    newCertTypes: new Map(),
    newCertificates: new Map(),
    seenRecords: new Map(),
  };
}

/* --------------------------------------------------------------- member */

type MemberResolution = { email: string | null; ref: MemberRef | null };

function resolveMember(ctx: PlanContext, cells: RowCells, rowNumber: number, issues: Issues): MemberResolution {
  const email = normalizeEmail(cells.email);
  if (!email.ok) {
    issues.errors.push(inColumn(ctx, "email", email.error));
    return { email: null, ref: null };
  }
  const fileName = normalizeName(cells.memberName);
  const teamText = normalizeName(cells.team);

  const existing = ctx.membersByEmail.get(email.value);
  if (existing) {
    warnAboutExistingMember(ctx, existing, fileName, teamText, issues);
    return { email: email.value, ref: { id: existing.id } };
  }

  const firstRow = ctx.newMembers.get(email.value);
  if (firstRow) {
    if (fileName !== null && foldText(fileName) !== foldText(firstRow.ref.fullName)) {
      issues.warnings.push(`Same email as row ${firstRow.rowNumber} but a different name — using the name from row ${firstRow.rowNumber}`);
    }
    return { email: email.value, ref: firstRow.ref };
  }

  const errorsBefore = issues.errors.length;
  if (fileName === null) issues.errors.push(inColumn(ctx, "memberName", "a value is required to create the new member."));
  const teamId = resolveNewMemberTeam(ctx, teamText, issues);
  if (issues.errors.length > errorsBefore || fileName === null) return { email: email.value, ref: null };

  const ref = { email: email.value, fullName: fileName, teamId };
  ctx.newMembers.set(email.value, { ref, rowNumber });
  return { email: email.value, ref };
}

/** Decision #21: an existing member is never renamed or moved — only warn. */
function warnAboutExistingMember(
  ctx: PlanContext,
  member: ImportLookups["members"][number],
  fileName: string | null,
  teamText: string | null,
  issues: Issues,
): void {
  if (fileName !== null && foldText(fileName) !== foldText(member.fullName)) {
    issues.warnings.push(`Name in the file "${fileName}" differs from the existing name "${member.fullName}" — keeping the existing name`);
  }
  if (teamText !== null) {
    const matches = ctx.teamsByName.get(foldText(teamText)) ?? [];
    if (!matches.some((team) => team.id === member.teamId)) {
      issues.warnings.push(`Team in the file "${teamText}" differs from the current team — import does not move members`);
    }
  }
  if (!member.isActive) issues.warnings.push("This member is inactive");
}

/** Teams are never created: a new member's team must already exist and be unambiguous. */
function resolveNewMemberTeam(ctx: PlanContext, teamText: string | null, issues: Issues): string | null {
  if (teamText === null) {
    issues.warnings.push("The new member has no team");
    return null;
  }
  const matches = ctx.teamsByName.get(foldText(teamText)) ?? [];
  if (matches.length === 1) return matches[0]!.id;
  issues.errors.push(
    inColumn(
      ctx,
      "team",
      matches.length === 0 ? `"${teamText}" not found.` : `more than one team is named "${teamText}". Rename them so they differ.`,
    ),
  );
  return null;
}

/* ----------------------------------------------------------- certificate */

/** `name` is the catalogue name of an existing certificate, else the name written in the file. */
type CertificateResolution = { ref: CertificateRef | null; key: string | null; name: string | null };
const NO_CERTIFICATE: CertificateResolution = { ref: null, key: null, name: null };

function resolveCertificate(ctx: PlanContext, cells: RowCells, rowNumber: number, issues: Issues, optional = false): CertificateResolution {
  const name = normalizeName(cells.courseName);
  if (name === null) {
    if (!optional) issues.errors.push(inColumn(ctx, "courseName", "a value is required."));
    return NO_CERTIFICATE;
  }
  const providerText = normalizeName(cells.provider);
  const certTypeText = normalizeName(cells.certType);
  const validity = parseValidityMonths(cells.validityMonths);
  if (!validity.ok) issues.errors.push(inColumn(ctx, "validityMonths", validity.error));
  const validityMonths = validity.ok ? validity.value : null;
  const errorsBeforeExtras = issues.errors.length;
  const cost = take(ctx, "cost", parseCost(cells.cost), issues, null);
  const costCurrency = take(ctx, "costCurrency", parseCurrency(cells.costCurrency), issues, null);
  const estHours = take(ctx, "estHours", parseStudyHours(cells.estHours), issues, null);
  const extras: CourseDetails = { cost, costCurrency, estHours };

  const sameName = ctx.certificatesByName.get(foldText(name)) ?? [];
  let existing: ImportLookups["certificates"][number] | undefined;
  if (providerText === null) {
    if (sameName.length > 1) {
      issues.errors.push(inColumn(ctx, "courseName", `"${name}" matches more than one certificate. Fill in the Provider column to pick one.`));
      return NO_CERTIFICATE;
    }
    if (sameName.length === 0) {
      issues.errors.push(inColumn(ctx, "courseName", `"${name}" is not in the catalogue. Fill in the Provider column to create it.`));
      return NO_CERTIFICATE;
    }
    existing = sameName[0];
  } else {
    const provider = ctx.providersByName.get(foldText(providerText));
    existing = provider ? sameName.find((certificate) => certificate.providerId === provider.id) : undefined;
  }

  if (existing) {
    const priced = findStudyCourse(ctx, cells, existing.id) ?? existing;
    warnAboutCatalogDifferences(ctx, existing, priced, { certTypeText, validityMonths, ...extras }, issues);
    return { ref: { id: existing.id }, key: existing.id, name: existing.name };
  }
  if (!validity.ok || providerText === null) return NO_CERTIFICATE;
  // A new certificate is written to the database, where cost and currency must come as a pair.
  if (cost !== null && costCurrency === null) issues.errors.push(inColumn(ctx, "costCurrency", `choose VND or USD for the cost "${cellText(cells.cost)}".`));
  if (cost === null && costCurrency !== null) issues.errors.push(inColumn(ctx, "cost", `enter a cost for the currency "${cellText(cells.costCurrency)}", or clear the currency.`));
  // Never register an invalid definition: a later row for the same new certificate would reuse it and fail the commit.
  if (issues.errors.length > errorsBeforeExtras) return NO_CERTIFICATE;
  return defineNewCertificate(ctx, { name, providerText, certTypeText, validityMonths, ...extras }, rowNumber, issues);
}

/** Cost, currency and study hours (the course studied) as read from a row; a cost counts only together with its currency. */
type CourseDetails = { cost: number | null; costCurrency: Currency | null; estHours: number | null };
/** commit_import creates the self-preparing course when the row has a cost, a currency or hours. */
export const hasCourseDetails = (details: { cost?: number | null; costCurrency?: string | null; estHours?: number | null }): boolean =>
  details.cost != null || details.costCurrency != null || details.estHours != null;
const hasCost = (extras: CourseDetails): extras is { cost: number; costCurrency: Currency; estHours: number | null } =>
  extras.cost !== null && extras.costCurrency !== null;

/** The catalog wins; a non-blank value in the file that disagrees with it is only a warning. */
function warnAboutCatalogDifferences(
  ctx: PlanContext,
  certificate: ImportLookups["certificates"][number],
  priced: CourseDetails,
  input: { certTypeText: string | null; validityMonths: number | null } & CourseDetails,
  issues: Issues,
): void {
  const { certTypeText, validityMonths } = input;
  if (certTypeText !== null) {
    const catalogName = certificate.certTypeId === null ? null : ctx.certTypeNameById.get(certificate.certTypeId) ?? null;
    if (catalogName === null || foldText(catalogName) !== foldText(certTypeText)) {
      issues.warnings.push("Certificate type in the file differs from the catalogue — keeping the catalogue");
    }
  }
  if (validityMonths !== null && validityMonths !== certificate.validityMonths) {
    issues.warnings.push("Validity in the file differs from the catalogue — keeping the catalogue");
  }
  if (hasCost(input) && (input.cost !== priced.cost || input.costCurrency !== priced.costCurrency)) {
    issues.warnings.push("Cost in the file differs from the catalogue — keeping the catalogue");
  }
  if (input.estHours !== null && input.estHours !== priced.estHours) {
    issues.warnings.push("Study hours in the file differ from the catalogue — keeping the catalogue");
  }
}

/** The named course studied, when it prepares for (or is granted by) the certificate; `null` when it is blank or does not fit. */
function findStudyCourse(ctx: PlanContext, cells: RowCells, certificateId: string): ImportLookups["studyCourses"][number] | null {
  const name = normalizeName(cells.courseStudied);
  if (name === null) return null;
  const sameName = ctx.studyCoursesByName.get(foldText(name)) ?? [];
  return sameName.find((course) => course.preparesForId === certificateId || course.grantsId === certificateId) ?? null;
}

/**
 * Spec 6.4: the course studied must prepare for the certificate; a new certificate has no course yet, so it cannot name one.
 * An unknown name is reported even when the certificate itself failed, so one upload shows every problem of the row.
 */
function resolveCourseStudied(ctx: PlanContext, cells: RowCells, certificate: CertificateResolution, issues: Issues): { id: string } | null {
  const name = normalizeName(cells.courseStudied);
  if (name === null) return null;
  if (!ctx.studyCoursesByName.has(foldText(name))) {
    issues.errors.push(inColumn(ctx, "courseStudied", `"${name}" not found.`));
    return null;
  }
  if (certificate.ref === null) return null;
  const course = hasId(certificate.ref) ? findStudyCourse(ctx, cells, certificate.ref.id) : null;
  if (course === null) {
    issues.errors.push(inColumn(ctx, "courseStudied", `"${name}" does not prepare for "${certificate.name}".`));
    return null;
  }
  return { id: course.id };
}

/** A provider / cert type: the existing one by folded name, else the first spelling seen in this file. */
function resolveCatalogRef(existing: Map<string, { id: string }>, created: Map<string, string>, text: string): Ref {
  const key = foldText(text);
  const match = existing.get(key);
  if (match) return { id: match.id };
  if (!created.has(key)) created.set(key, text);
  return { name: created.get(key)! };
}

function defineNewCertificate(
  ctx: PlanContext,
  input: { name: string; providerText: string; certTypeText: string | null; validityMonths: number | null } & CourseDetails,
  rowNumber: number,
  issues: Issues,
): CertificateResolution {
  const certificateKey = `${foldText(input.providerText)}|${foldText(input.name)}`;
  const key = `new:${certificateKey}`;
  const first = ctx.newCertificates.get(certificateKey);
  if (first) {
    if (input.validityMonths !== null && input.validityMonths !== first.ref.validityMonths) {
      issues.warnings.push(`Validity differs from the new certificate defined in row ${first.rowNumber} — using the first definition`);
    }
    if (hasCost(input) && (input.cost !== first.ref.cost || input.costCurrency !== first.ref.costCurrency)) {
      issues.warnings.push(`Cost differs from the new certificate defined in row ${first.rowNumber} — using the first definition`);
    }
    if (input.estHours !== null && input.estHours !== first.ref.estHours) {
      issues.warnings.push(`Study hours differ from the new certificate defined in row ${first.rowNumber} — using the first definition`);
    }
    return { ref: first.ref, key, name: first.ref.name };
  }
  const ref = {
    name: input.name,
    provider: resolveCatalogRef(ctx.providersByName, ctx.newProviders, input.providerText),
    certType: input.certTypeText === null ? null : resolveCatalogRef(ctx.certTypesByName, ctx.newCertTypes, input.certTypeText),
    validityMonths: input.validityMonths,
    cost: input.cost,
    costCurrency: input.costCurrency,
    estHours: input.estHours,
  };
  ctx.newCertificates.set(certificateKey, { ref, rowNumber });
  return { ref, key, name: ref.name };
}

/* -------------------------------------------------------- record cells */

const MAX_NOTES_LENGTH = 2000;

/** Pushes the error (if any) and returns `fallback` so one row reports every bad cell, not just the first. */
function take<T>(ctx: PlanContext, field: ImportField, cleaned: Cleaned<T>, issues: Issues, fallback: T): T {
  if (cleaned.ok) return cleaned.value;
  issues.errors.push(inColumn(ctx, field, cleaned.error));
  return fallback;
}

type RecordCells = Omit<NormalizedRecord, "status" | "progress"> & { status: RecordStatus | null; progress: number | null };

function readRecordCells(ctx: PlanContext, cells: RowCells, issues: Issues): RecordCells {
  const notes = normalizeNotes(cells.notes);
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) issues.errors.push(inColumn(ctx, "notes", `longer than ${MAX_NOTES_LENGTH} characters.`));
  return {
    status: take(ctx, "status", normalizeStatus(cells.status), issues, null),
    progress: take(ctx, "progress", progressToPercent(cells.progress, ctx.progressMode), issues, null),
    plannedExamDate: take(ctx, "plannedExamDate", parseImportDate(cells.plannedExamDate, ctx.date1904), issues, null),
    issuedDate: take(ctx, "issuedDate", parseImportDate(cells.issuedDate, ctx.date1904), issues, null),
    certificateUrl: take(ctx, "certificateUrl", normalizeUrl(cells.certificateUrl), issues, null),
    viaCompany: take(ctx, "viaCompany", normalizeBoolean(cells.viaCompany), issues, null),
    refundStatus: take(ctx, "refundStatus", normalizeRefund(cells.refundStatus), issues, null),
    notes,
  };
}

/* ------------------------------------------------------ action + rows */

const hasId = <T extends { id: string } | object>(ref: T): ref is Extract<T, { id: string }> => "id" in ref;

function decideAction(record: NormalizedRecord, courseStudied: { id: string } | null, existing: ExistingRecord | undefined): PlannedRow["action"] {
  if (!existing) return "create";
  const unchanged =
    // no course named = "not provided", which counts as equal to whatever the database holds
    (courseStudied === null || courseStudied.id === existing.courseId) &&
    record.status === existing.status &&
    record.progress === existing.progress &&
    // null = "not provided", which counts as equal to whatever the database holds
    (record.plannedExamDate === null || record.plannedExamDate === existing.plannedExamDate) &&
    (record.issuedDate === null || record.issuedDate === existing.issuedDate) &&
    (record.certificateUrl === null || record.certificateUrl === existing.certificateUrl) &&
    (record.viaCompany === null || record.viaCompany === existing.viaCompany) &&
    (record.refundStatus === null || record.refundStatus === existing.refundStatus) &&
    (record.notes === null || record.notes === existing.notes);
  return unchanged ? "skip" : "update";
}

function decideLearningAction(
  record: NormalizedRecord,
  course: { id: string } | null,
  existing: ExistingLearningItem | undefined,
): PlannedRow["action"] {
  if (!existing) return "create";
  const unchanged =
    // no course named = "not provided": commit_import keeps the item's course
    (course === null || course.id === existing.courseId) &&
    record.status === existing.status &&
    record.progress === existing.progress &&
    (record.plannedExamDate === null || record.plannedExamDate === existing.plannedDate) &&
    (record.issuedDate === null || record.issuedDate === existing.finishedDate) &&
    (record.notes === null || record.notes === existing.notes);
  return unchanged ? "skip" : "update";
}

/** The course of a learning row, by name only: "prepares for" no longer limits it (decision #72). */
function resolveLearningCourse(ctx: PlanContext, cells: RowCells, issues: Issues): { id: string } | null {
  const name = normalizeName(cells.courseStudied);
  if (name === null) return null;
  const course = ctx.studyCoursesByName.get(foldText(name))?.[0];
  if (!course) {
    issues.errors.push(inColumn(ctx, "courseStudied", `"${name}" not found.`));
    return null;
  }
  return { id: course.id };
}

function planRow(ctx: PlanContext, table: ImportTable, source: ImportTable["rows"][number]): PlannedRow {
  const cells = Object.fromEntries(
    IMPORT_FIELDS.map((field) => {
      const column = table.map[field];
      return [field, column === undefined ? null : source.cells[column] ?? null];
    }),
  ) as RowCells;
  const issues: Issues = { errors: [], warnings: [] };
  const base = {
    rowNumber: source.rowNumber,
    raw: {
      cells: Object.fromEntries(table.headers.map((header, index) => [header, source.cells[index] ?? null])),
      email: cellText(cells.email),
      course: cellText(cells.courseName),
    },
  };

  const recordType = take(ctx, "recordType", normalizeRecordType(cells.recordType), issues, null);
  const record = readRecordCells(ctx, cells, issues);
  const member = resolveMember(ctx, cells, source.rowNumber, issues);
  const certificate = resolveCertificate(ctx, cells, source.rowNumber, issues, true);
  const existingRecord =
    member.ref !== null && certificate.ref !== null && hasId(member.ref) && hasId(certificate.ref)
      ? ctx.recordsByKey.get(`${member.ref.id}|${certificate.ref.id}`)
      : undefined;
  // The kind needs a status before matching: the inference reconcileRecord makes, without its messages.
  const firstStatus = reconcileRecord(record, existingRecord ?? null, ctx.today, () => "").status;
  const kind = routeImportRow({ recordType, status: firstStatus });
  if (kind === "certificate" && normalizeName(cells.courseName) === null) {
    issues.errors.push(inColumn(ctx, "courseName", "a value is required."));
  }
  const skipped = (): PlannedRow => ({ ...base, normalized: null, action: "skip", ...issues });

  if (kind === "learning") {
    let course = resolveLearningCourse(ctx, cells, issues);
    // A course certificate is never an exam target: the item follows the course that grants it (decision #72).
    const grantingCourse =
      certificate.ref !== null && hasId(certificate.ref) ? ctx.grantsCourseByCertificate.get(certificate.ref.id) : undefined;
    const targetRef = grantingCourse ? null : certificate.ref;
    if (grantingCourse) course ??= { id: grantingCourse };
    if (normalizeName(cells.courseName) === null && normalizeName(cells.courseStudied) === null) {
      issues.errors.push("Certificate or Course studied is required on a Learning row.");
    }
    if (member.email !== null) {
      const examKey = targetRef === null ? "" : certificate.key ?? "";
      const recordKey = `${member.email}|learning|${examKey ? "" : course?.id ?? ""}|${examKey}`;
      const firstRow = ctx.seenRecords.get(recordKey);
      if (firstRow === undefined) ctx.seenRecords.set(recordKey, source.rowNumber);
      else issues.errors.push(`Duplicate of row ${firstRow} (same email and ${examKey ? "exam" : "course"})`);
    }
    if (issues.errors.length > 0 || member.ref === null) return skipped();

    const targetId = targetRef !== null && hasId(targetRef) ? targetRef.id : null;
    const newTarget = targetRef !== null && targetId === null;
    const existing =
      hasId(member.ref) && !newTarget ? ctx.learningByKey.get(learningKey(member.ref.id, course?.id ?? null, targetId)) : undefined;
    const reconciled = reconcileRecord(
      record,
      existing ? { status: existing.status, progress: existing.progress, issuedDate: existing.finishedDate } : null,
      ctx.today,
      (field, message) => inColumn(ctx, field, message),
    );
    issues.errors.push(...reconciled.errors);
    issues.warnings.push(...reconciled.warnings);
    if (issues.errors.length > 0) return skipped();

    // A learning row's "Issued date" is the day the item was finished.
    const issuedDate = reconciled.status === "done" ? record.issuedDate ?? existing?.finishedDate ?? null : record.issuedDate;
    const normalizedRecord: NormalizedRecord = { ...record, status: reconciled.status, progress: reconciled.progress, issuedDate };
    return {
      ...base,
      normalized: { kind: "learning", member: member.ref, course: targetRef, ...(course && { courseStudied: course }), record: normalizedRecord },
      action: decideLearningAction(normalizedRecord, course, existing),
      ...issues,
    };
  }

  const courseStudied = resolveCourseStudied(ctx, cells, certificate, issues);
  if (recordType === "certificate" && firstStatus !== "done") {
    issues.errors.push(inColumn(ctx, "status", "a certificate is Completed. Use Item type Learning for a course or exam in progress."));
  }

  if (member.email !== null && certificate.key !== null) {
    const recordKey = `${member.email}|${certificate.key}`;
    const firstRow = ctx.seenRecords.get(recordKey);
    if (firstRow === undefined) ctx.seenRecords.set(recordKey, source.rowNumber);
    else issues.errors.push(`Duplicate of row ${firstRow} (same email and certificate)`);
  }

  if (issues.errors.length > 0 || member.ref === null || certificate.ref === null) return skipped();

  const existing = existingRecord;
  const reconciled = reconcileRecord(record, existing ?? null, ctx.today, (field, message) => inColumn(ctx, field, message));
  issues.errors.push(...reconciled.errors);
  issues.warnings.push(...reconciled.warnings);
  if (issues.errors.length > 0) return skipped();

  // commit_import upserts with INSERT ... ON CONFLICT, and PostgreSQL checks the CHECK constraints on the proposed
  // insert row before conflict detection. A done record therefore must carry its issue date even when it only
  // exists in the database (reconcileRecord accepted it), or the whole batch aborts with 23514.
  const issuedDate = reconciled.status === "done" ? record.issuedDate ?? existing?.issuedDate ?? null : record.issuedDate;
  const normalizedRecord: NormalizedRecord = { ...record, status: reconciled.status, progress: reconciled.progress, issuedDate };
  return {
    ...base,
    normalized: { kind: "certificate", member: member.ref, course: certificate.ref, ...(courseStudied && { courseStudied }), record: normalizedRecord },
    action: decideAction(normalizedRecord, courseStudied, existing),
    ...issues,
  };
}

/* ----------------------------------------------------------- entry point */

/** Entities this plan will create — counted from `create` rows only, unique, in first-seen order. */
function collectNewEntities(rows: PlannedRow[]): ImportPlan["newEntities"] {
  const members = new Map<string, string>();
  const providers = new Map<string, string>();
  const certTypes = new Map<string, string>();
  const certificates = new Map<string, string>();
  const courses = new Map<string, string>();
  for (const row of rows) {
    if (row.action !== "create" || row.normalized === null) continue;
    const { member, course: certificate } = row.normalized;
    if (!hasId(member)) members.set(member.email, member.fullName);
    if (certificate === null || hasId(certificate)) continue;
    const providerKey = hasId(certificate.provider) ? certificate.provider.id : `new:${foldText(certificate.provider.name)}`;
    const key = `${providerKey}|${foldText(certificate.name)}`;
    certificates.set(key, certificate.name);
    if (hasCourseDetails(certificate)) courses.set(key, certificate.name);
    if (!hasId(certificate.provider)) providers.set(foldText(certificate.provider.name), certificate.provider.name);
    if (certificate.certType && !hasId(certificate.certType)) certTypes.set(foldText(certificate.certType.name), certificate.certType.name);
  }
  return {
    members: [...members.values()], providers: [...providers.values()], certTypes: [...certTypes.values()],
    certificates: [...certificates.values()], courses: [...courses.values()],
  };
}

export function buildImportPlan(table: ImportTable, lookups: ImportLookups, today: string): ImportPlan {
  const ctx = createContext(table, lookups, today);
  const rows = table.rows.map((source) => planRow(ctx, table, source));

  const notes = [`Sheet "${table.sheetName}", headers in row ${table.headerRowNumber}.`];
  if (ctx.progressMode === "fraction") notes.push("The progress column is read as a fraction from 0 to 1 (for example 0.75 = 75%).");
  if (table.unknownColumns.length > 0) notes.push(`Ignored columns: ${table.unknownColumns.join(", ")}.`);

  return { rows, notes, newEntities: collectNewEntities(rows) };
}
