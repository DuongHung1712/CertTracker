import type { ImportLookups, PlannedRow } from "@/features/import/plan";
import {
  importActionSchema,
  importStatusSchema,
  importSummarySchema,
  messagesSchema,
  normalizedRefsSchema,
  rawSchema,
  type ImportSummary,
  type NormalizedRefs,
} from "@/features/import/schema";
import { toCurrency } from "@/lib/money";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export type ImportBatch = {
  id: string;
  fileName: string;
  status: "parsed" | "committed" | "discarded";
  summary: ImportSummary | null;
  createdAt: string;
};

export type ImportBatchDetail = ImportBatch & {
  sheetName: string | null;
  /** Row count the parse announced; the stored rows must match it for the batch to be committable. */
  expectedRows: number;
  /** Sheet-level notes from the parse (e.g. skipped title rows, unknown columns). */
  notes: string[];
  committedAt: string | null;
};

export type ImportRowView = {
  id: string;
  rowNo: number;
  action: "create" | "update" | "skip";
  raw: PlannedRow["raw"];
  /** Only the member/course references; `null` for skipped rows. */
  refs: NormalizedRefs;
  errors: string[];
  warnings: string[];
};

/**
 * Everything `buildImportPlan` needs to resolve names to ids. Read through the caller's JWT, so it is
 * only meaningful for an Admin (the parse route checks the role first; RLS also hides rows otherwise).
 */
export async function loadImportLookups(): Promise<ImportLookups> {
  const supabase = await createClient();
  const [members, teams, providers, certTypes, certificates, preparingCourses, records] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase.from("members").select("id, email, full_name, team_id, is_active").order("email").order("id").range(from, to),
    ),
    fetchAllRows((from, to) => supabase.from("teams").select("id, name").order("name").order("id").range(from, to)),
    fetchAllRows((from, to) => supabase.from("providers").select("id, name").order("name").order("id").range(from, to)),
    fetchAllRows((from, to) => supabase.from("cert_types").select("id, name").order("name").order("id").range(from, to)),
    fetchAllRows((from, to) =>
      supabase
        .from("certificates")
        .select("id, name, provider_id, cert_type_id, validity_months")
        .order("name")
        .order("id")
        .range(from, to),
    ),
    // Cost and hours live on the course that prepares for a certificate (a sheet "course" is a certificate until Part D5).
    fetchAllRows((from, to) =>
      supabase
        .from("courses")
        .select("id, prepares_for_id, cost, cost_currency, est_hours")
        .not("prepares_for_id", "is", null)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("training_records")
        .select(
          "id, member_id, certificate_id, status, progress, planned_exam_date, issued_date, certificate_url, via_company, refund_status, notes",
        )
        .order("member_id")
        .order("certificate_id")
        .order("id")
        .range(from, to),
    ),
  ]);

  const courseByCertificate = new Map(preparingCourses.map((p) => [p.prepares_for_id, p]));
  return {
    members: members.map((m) => ({
      id: m.id,
      email: m.email.toLowerCase(),
      fullName: m.full_name,
      teamId: m.team_id,
      isActive: m.is_active,
    })),
    teams,
    providers,
    certTypes,
    courses: certificates.map((c) => {
      const course = courseByCertificate.get(c.id);
      return {
        id: c.id,
        name: c.name,
        providerId: c.provider_id,
        certTypeId: c.cert_type_id,
        validityMonths: c.validity_months,
        cost: course?.cost ?? null,
        costCurrency: toCurrency(course?.cost_currency ?? null),
        estHours: course?.est_hours ?? null,
      };
    }),
    records: records.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      courseId: r.certificate_id,
      status: r.status,
      progress: r.progress,
      plannedExamDate: r.planned_exam_date,
      issuedDate: r.issued_date,
      certificateUrl: r.certificate_url,
      viaCompany: r.via_company,
      refundStatus: r.refund_status,
      notes: r.notes,
    })),
  };
}

type BatchRow = { id: string; file_name: string; status: string; summary: unknown; created_at: string };

function toBatch(row: BatchRow): ImportBatch {
  return {
    id: row.id,
    fileName: row.file_name,
    status: importStatusSchema.catch("parsed").parse(row.status),
    summary: importSummarySchema.nullable().catch(null).parse(row.summary),
    createdAt: row.created_at,
  };
}

/** The 20 most recent batches. Admin only (RLS); anyone else gets an empty list. */
export async function listImportBatches(): Promise<ImportBatch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, file_name, status, summary, created_at")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(20);
  if (error) throw new Error(error.message);
  return data.map(toBatch);
}

/** `null` when the batch does not exist or RLS hides it. */
export async function getImportBatch(id: string): Promise<ImportBatchDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, file_name, sheet_name, status, notes, summary, created_at, committed_at, expected_rows")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    ...toBatch(data),
    sheetName: data.sheet_name,
    expectedRows: data.expected_rows,
    notes: messagesSchema.parse(data.notes),
    committedAt: data.committed_at,
  };
}

/** Rows of one batch in file order. */
export async function listImportRows(batchId: string): Promise<ImportRowView[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("import_rows")
      .select("id, row_no, action, raw, normalized, errors, warnings")
      .eq("batch_id", batchId)
      .order("row_no")
      .order("id")
      .range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    rowNo: row.row_no,
    action: importActionSchema.catch("skip").parse(row.action),
    raw: rawSchema.parse(row.raw),
    refs: normalizedRefsSchema.parse(row.normalized),
    errors: messagesSchema.parse(row.errors),
    warnings: messagesSchema.parse(row.warnings),
  }));
}
