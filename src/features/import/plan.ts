import { RECORD_STATUS_LABEL, type RecordStatus } from "@/components/status/labels";
import {
  cellText, detectProgressMode, IMPORT_FIELDS, normalizeBoolean, normalizeEmail, normalizeName, normalizeRefund,
  normalizeStatus, normalizeUrl, parseImportDate, parseValidityMonths, progressToPercent,
  type Cell, type Cleaned, type ImportField, type ImportTable, type ProgressMode,
} from "@/features/import/clean";
import { recordRuleIssues, type RefundStatus } from "@/features/records/schema";
import { foldText } from "@/lib/text";

/* ---------------------------------------------------------------- types */

export type ExistingRecord = {
  id: string; memberId: string; courseId: string; status: RecordStatus; progress: number;
  plannedExamDate: string | null; issuedDate: string | null; certificateUrl: string | null;
  viaCompany: boolean; refundStatus: RefundStatus; notes: string | null;
};

export type ImportLookups = {
  members: { id: string; email: string; fullName: string; teamId: string | null; isActive: boolean }[];
  teams: { id: string; name: string }[];
  providers: { id: string; name: string }[];
  certTypes: { id: string; name: string }[];
  courses: { id: string; name: string; providerId: string | null; certTypeId: string | null; validityMonths: number | null }[];
  records: ExistingRecord[];
};

export type Ref = { id: string } | { name: string };
type MemberRef = { id: string } | { email: string; fullName: string; teamId: string | null };
type CourseRef = { id: string } | { name: string; provider: Ref; certType: Ref | null; validityMonths: number | null };
type NormalizedRecord = {
  status: RecordStatus; progress: number;
  plannedExamDate: string | null; issuedDate: string | null; certificateUrl: string | null;
  viaCompany: boolean | null; refundStatus: RefundStatus | null; notes: string | null;
};

/** The `normalized` JSON contract that `commit_import` consumes (migration 20261001000001). */
export type NormalizedRow = { member: MemberRef; course: CourseRef; record: NormalizedRecord };

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
  newEntities: { members: string[]; providers: string[]; certTypes: string[]; courses: string[] };
};

type Issues = { errors: string[]; warnings: string[] };
type RowCells = Record<ImportField, Cell>;

/* ------------------------------------------------------------ reconcile */

type ReconcileInput = { status: RecordStatus | null; progress: number | null; issuedDate: string | null };
type Reconciled = { status: RecordStatus; progress: number; errors: string[]; warnings: string[] };

/** Decision #22: status wins over progress; every correction leaves a warning. `existing` supplies a known issue date and progress. */
export function reconcileRecord(input: ReconcileInput, existing: ExistingRecord | null, today: string): Reconciled {
  const warnings: string[] = [];
  const issuedDate = input.issuedDate ?? existing?.issuedDate ?? null;
  let { status, progress } = input;

  if (status === null && progress === null) {
    if (!existing) return { status: "not_started", progress: 0, errors: ["Thiếu trạng thái và tiến độ"], warnings };
    ({ status, progress } = existing);
  } else if (status === null) {
    const value = progress as number;
    status = value === 0 ? "not_started" : "in_progress"; // 100 is settled by alignWithStatus (done or 99%)
    if (value !== 100) warnings.push("Suy ra trạng thái từ tiến độ");
  } else if (progress === null) {
    progress = deriveProgress(status, existing, warnings);
  }

  const aligned = alignWithStatus(status, progress as number, issuedDate !== null, warnings);
  const errors = recordRuleIssues({ ...aligned, issuedDate }, today).map((issue) => issue.message);
  return { ...aligned, errors, warnings };
}

function deriveProgress(status: RecordStatus, existing: ExistingRecord | null, warnings: string[]): number {
  if (status === "done") return 100;
  if (status === "not_started") return 0;
  if (existing?.status === "in_progress") return existing.progress;
  warnings.push("Không có tiến độ — đặt 0%");
  return 0;
}

function alignWithStatus(
  status: RecordStatus,
  progress: number,
  hasIssuedDate: boolean,
  warnings: string[],
): { status: RecordStatus; progress: number } {
  if (status === "done" && progress !== 100) {
    warnings.push(`Trạng thái ${RECORD_STATUS_LABEL.done}: đặt tiến độ 100% (file ghi ${progress}%)`);
    return { status, progress: 100 };
  }
  if (status === "not_started" && progress > 0) {
    const next: RecordStatus = progress === 100 ? "done" : "in_progress";
    warnings.push(`Có tiến độ ${progress}% — chuyển sang ${RECORD_STATUS_LABEL[next]}`);
    return { status: next, progress };
  }
  if (status === "in_progress" && progress === 100) {
    if (hasIssuedDate) {
      warnings.push(`Tiến độ 100% — chuyển sang ${RECORD_STATUS_LABEL.done}`);
      return { status: "done", progress };
    }
    warnings.push("Tiến độ 100% nhưng chưa có ngày cấp — đặt 99%");
    return { status, progress: 99 };
  }
  return { status, progress };
}

/* -------------------------------------------------------------- context */

type FirstNewMember = { ref: { email: string; fullName: string; teamId: string | null }; rowNumber: number };
type FirstNewCourse = { ref: Extract<CourseRef, { name: string }>; rowNumber: number };

/** Lookup indexes plus the "first definition wins" state shared by every row of one plan. */
type PlanContext = {
  today: string;
  date1904: boolean;
  progressMode: ProgressMode;
  membersByEmail: Map<string, ImportLookups["members"][number]>;
  teamsByName: Map<string, ImportLookups["teams"]>;
  providersByName: Map<string, { id: string }>;
  certTypesByName: Map<string, { id: string }>;
  certTypeNameById: Map<string, string>;
  coursesByName: Map<string, ImportLookups["courses"]>;
  recordsByKey: Map<string, ExistingRecord>;
  newMembers: Map<string, FirstNewMember>;
  newProviders: Map<string, string>;
  newCertTypes: Map<string, string>;
  newCourses: Map<string, FirstNewCourse>;
  seenRecords: Map<string, number>;
};

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
    today,
    date1904: table.date1904,
    progressMode: progressColumn === undefined ? "percent" : detectProgressMode(table.rows.map((row) => row.cells[progressColumn])),
    membersByEmail: new Map(lookups.members.map((member) => [member.email.toLowerCase(), member])),
    teamsByName: groupBy(lookups.teams, (team) => foldText(team.name)),
    providersByName: firstByName(lookups.providers),
    certTypesByName: firstByName(lookups.certTypes),
    certTypeNameById: new Map(lookups.certTypes.map((certType) => [certType.id, certType.name])),
    coursesByName: groupBy(lookups.courses, (course) => foldText(course.name)),
    recordsByKey: new Map(lookups.records.map((record) => [`${record.memberId}|${record.courseId}`, record])),
    newMembers: new Map(),
    newProviders: new Map(),
    newCertTypes: new Map(),
    newCourses: new Map(),
    seenRecords: new Map(),
  };
}

/* --------------------------------------------------------------- member */

type MemberResolution = { email: string | null; ref: MemberRef | null };

function resolveMember(ctx: PlanContext, cells: RowCells, rowNumber: number, issues: Issues): MemberResolution {
  const email = normalizeEmail(cells.email);
  if (!email.ok) {
    issues.errors.push(email.error);
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
      issues.warnings.push(`Email trùng dòng ${firstRow.rowNumber} nhưng khác tên — dùng tên ở dòng ${firstRow.rowNumber}`);
    }
    return { email: email.value, ref: firstRow.ref };
  }

  const errorsBefore = issues.errors.length;
  if (fileName === null) issues.errors.push("Thiếu họ tên để tạo thành viên mới");
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
    issues.warnings.push(`Tên trong file "${fileName}" khác tên hiện có "${member.fullName}" — giữ tên hiện có`);
  }
  if (teamText !== null) {
    const matches = ctx.teamsByName.get(foldText(teamText)) ?? [];
    if (!matches.some((team) => team.id === member.teamId)) {
      issues.warnings.push(`Team trong file "${teamText}" khác team hiện tại — nhập dữ liệu không chuyển team`);
    }
  }
  if (!member.isActive) issues.warnings.push("Thành viên đang ngừng hoạt động");
}

/** Teams are never created: a new member's team must already exist and be unambiguous. */
function resolveNewMemberTeam(ctx: PlanContext, teamText: string | null, issues: Issues): string | null {
  if (teamText === null) {
    issues.warnings.push("Thành viên mới chưa có team");
    return null;
  }
  const matches = ctx.teamsByName.get(foldText(teamText)) ?? [];
  if (matches.length === 1) return matches[0]!.id;
  issues.errors.push(
    matches.length === 0 ? `Không tìm thấy team "${teamText}"` : `Có nhiều team tên "${teamText}" — sửa tên team cho rõ`,
  );
  return null;
}

/* --------------------------------------------------------------- course */

type CourseResolution = { ref: CourseRef | null; key: string | null };
const NO_COURSE: CourseResolution = { ref: null, key: null };

function resolveCourse(ctx: PlanContext, cells: RowCells, rowNumber: number, issues: Issues): CourseResolution {
  const name = normalizeName(cells.courseName);
  if (name === null) {
    issues.errors.push("Thiếu tên khóa học");
    return NO_COURSE;
  }
  const providerText = normalizeName(cells.provider);
  const certTypeText = normalizeName(cells.certType);
  const validity = parseValidityMonths(cells.validityMonths);
  if (!validity.ok) issues.errors.push(validity.error);
  const validityMonths = validity.ok ? validity.value : null;

  const sameName = ctx.coursesByName.get(foldText(name)) ?? [];
  let existing: ImportLookups["courses"][number] | undefined;
  if (providerText === null) {
    if (sameName.length > 1) {
      issues.errors.push(`Có nhiều khóa học tên "${name}" — thêm cột Nhà cung cấp`);
      return NO_COURSE;
    }
    if (sameName.length === 0) {
      issues.errors.push(`Không tìm thấy khóa học "${name}" — cần Nhà cung cấp để tạo mới`);
      return NO_COURSE;
    }
    existing = sameName[0];
  } else {
    const provider = ctx.providersByName.get(foldText(providerText));
    existing = provider ? sameName.find((course) => course.providerId === provider.id) : undefined;
  }

  if (existing) {
    warnAboutCatalogDifferences(ctx, existing, certTypeText, validityMonths, issues);
    return { ref: { id: existing.id }, key: existing.id };
  }
  if (!validity.ok || providerText === null) return NO_COURSE;
  return defineNewCourse(ctx, { name, providerText, certTypeText, validityMonths }, rowNumber, issues);
}

/** The catalog wins; a non-blank value in the file that disagrees with it is only a warning. */
function warnAboutCatalogDifferences(
  ctx: PlanContext,
  course: ImportLookups["courses"][number],
  certTypeText: string | null,
  validityMonths: number | null,
  issues: Issues,
): void {
  if (certTypeText !== null) {
    const catalogName = course.certTypeId === null ? null : ctx.certTypeNameById.get(course.certTypeId) ?? null;
    if (catalogName === null || foldText(catalogName) !== foldText(certTypeText)) {
      issues.warnings.push("Loại chứng chỉ trong file khác danh mục — giữ danh mục");
    }
  }
  if (validityMonths !== null && validityMonths !== course.validityMonths) {
    issues.warnings.push("Thời hạn trong file khác danh mục — giữ danh mục");
  }
}

/** A provider / cert type: the existing one by folded name, else the first spelling seen in this file. */
function resolveCatalogRef(existing: Map<string, { id: string }>, created: Map<string, string>, text: string): Ref {
  const key = foldText(text);
  const match = existing.get(key);
  if (match) return { id: match.id };
  if (!created.has(key)) created.set(key, text);
  return { name: created.get(key)! };
}

function defineNewCourse(
  ctx: PlanContext,
  input: { name: string; providerText: string; certTypeText: string | null; validityMonths: number | null },
  rowNumber: number,
  issues: Issues,
): CourseResolution {
  const courseKey = `${foldText(input.providerText)}|${foldText(input.name)}`;
  const key = `new:${courseKey}`;
  const first = ctx.newCourses.get(courseKey);
  if (first) {
    if (input.validityMonths !== null && input.validityMonths !== first.ref.validityMonths) {
      issues.warnings.push(`Thời hạn khác định nghĩa khóa học mới ở dòng ${first.rowNumber} — dùng định nghĩa đầu tiên`);
    }
    return { ref: first.ref, key };
  }
  const ref = {
    name: input.name,
    provider: resolveCatalogRef(ctx.providersByName, ctx.newProviders, input.providerText),
    certType: input.certTypeText === null ? null : resolveCatalogRef(ctx.certTypesByName, ctx.newCertTypes, input.certTypeText),
    validityMonths: input.validityMonths,
  };
  ctx.newCourses.set(courseKey, { ref, rowNumber });
  return { ref, key };
}

/* -------------------------------------------------------- record cells */

const MAX_NOTES_LENGTH = 2000;

/** Pushes the error (if any) and returns `fallback` so one row reports every bad cell, not just the first. */
function take<T>(cleaned: Cleaned<T>, issues: Issues, fallback: T): T {
  if (cleaned.ok) return cleaned.value;
  issues.errors.push(cleaned.error);
  return fallback;
}

type RecordCells = Omit<NormalizedRecord, "status" | "progress"> & { status: RecordStatus | null; progress: number | null };

function readRecordCells(ctx: PlanContext, cells: RowCells, issues: Issues): RecordCells {
  const notes = cellText(cells.notes);
  if (notes !== null && notes.length > MAX_NOTES_LENGTH) issues.errors.push(`Ghi chú dài quá ${MAX_NOTES_LENGTH} ký tự`);
  return {
    status: take(normalizeStatus(cells.status), issues, null),
    progress: take(progressToPercent(cells.progress, ctx.progressMode), issues, null),
    plannedExamDate: take(parseImportDate(cells.plannedExamDate, ctx.date1904), issues, null),
    issuedDate: take(parseImportDate(cells.issuedDate, ctx.date1904), issues, null),
    certificateUrl: take(normalizeUrl(cells.certificateUrl), issues, null),
    viaCompany: take(normalizeBoolean(cells.viaCompany, "Qua công ty"), issues, null),
    refundStatus: take(normalizeRefund(cells.refundStatus), issues, null),
    notes,
  };
}

/* ------------------------------------------------------ action + rows */

const hasId = <T extends { id: string } | object>(ref: T): ref is Extract<T, { id: string }> => "id" in ref;

function decideAction(record: NormalizedRecord, existing: ExistingRecord | undefined): PlannedRow["action"] {
  if (!existing) return "create";
  const unchanged =
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

  const member = resolveMember(ctx, cells, source.rowNumber, issues);
  const course = resolveCourse(ctx, cells, source.rowNumber, issues);
  const record = readRecordCells(ctx, cells, issues);

  if (member.email !== null && course.key !== null) {
    const recordKey = `${member.email}|${course.key}`;
    const firstRow = ctx.seenRecords.get(recordKey);
    if (firstRow === undefined) ctx.seenRecords.set(recordKey, source.rowNumber);
    else issues.errors.push(`Trùng với dòng ${firstRow} (cùng email và khóa học)`);
  }

  const skipped = (): PlannedRow => ({ ...base, normalized: null, action: "skip", ...issues });
  if (issues.errors.length > 0 || member.ref === null || course.ref === null) return skipped();

  const existing = hasId(member.ref) && hasId(course.ref) ? ctx.recordsByKey.get(`${member.ref.id}|${course.ref.id}`) : undefined;
  const reconciled = reconcileRecord(record, existing ?? null, ctx.today);
  issues.errors.push(...reconciled.errors);
  issues.warnings.push(...reconciled.warnings);
  if (issues.errors.length > 0) return skipped();

  const normalizedRecord: NormalizedRecord = { ...record, status: reconciled.status, progress: reconciled.progress };
  return {
    ...base,
    normalized: { member: member.ref, course: course.ref, record: normalizedRecord },
    action: decideAction(normalizedRecord, existing),
    ...issues,
  };
}

/* ----------------------------------------------------------- entry point */

/** Entities this plan will create — counted from `create` rows only, unique, in first-seen order. */
function collectNewEntities(rows: PlannedRow[]): ImportPlan["newEntities"] {
  const members = new Map<string, string>();
  const providers = new Map<string, string>();
  const certTypes = new Map<string, string>();
  const courses = new Map<string, string>();
  for (const row of rows) {
    if (row.action !== "create" || row.normalized === null) continue;
    const { member, course } = row.normalized;
    if (!hasId(member)) members.set(member.email, member.fullName);
    if (hasId(course)) continue;
    const providerKey = hasId(course.provider) ? course.provider.id : `new:${foldText(course.provider.name)}`;
    courses.set(`${providerKey}|${foldText(course.name)}`, course.name);
    if (!hasId(course.provider)) providers.set(foldText(course.provider.name), course.provider.name);
    if (course.certType && !hasId(course.certType)) certTypes.set(foldText(course.certType.name), course.certType.name);
  }
  return { members: [...members.values()], providers: [...providers.values()], certTypes: [...certTypes.values()], courses: [...courses.values()] };
}

export function buildImportPlan(table: ImportTable, lookups: ImportLookups, today: string): ImportPlan {
  const ctx = createContext(table, lookups, today);
  const rows = table.rows.map((source) => planRow(ctx, table, source));

  const notes = [`Sheet "${table.sheetName}", tiêu đề ở dòng ${table.headerRowNumber}.`];
  if (ctx.progressMode === "fraction") notes.push("Cột tiến độ được hiểu là tỉ lệ 0–1 (vd. 0,75 = 75%).");
  if (table.unknownColumns.length > 0) notes.push(`Bỏ qua các cột không dùng: ${table.unknownColumns.join(", ")}.`);

  return { rows, notes, newEntities: collectNewEntities(rows) };
}
