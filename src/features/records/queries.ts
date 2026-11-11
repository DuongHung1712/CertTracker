import type { RecordStatus } from "@/components/status/labels";
import { CERTIFICATE_KIND_LABEL, type CertificateKind } from "@/features/certificates/schema";
import type { CertificateChoice, StudyCourse } from "@/features/records/certificate-course";
import type { RefundStatus } from "@/features/records/schema";
import { toCurrency, type Currency } from "@/lib/money";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export type RecordRow = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberEmail: string;
  teamId: string | null;
  teamName: string | null;
  certificateId: string;
  certificateName: string;
  certificateKind: CertificateKind;
  /** The course studied (the granting course for a completion); null for self-study. */
  courseId: string | null;
  courseName: string | null;
  certTypeName: string | null;
  providerName: string | null;
  validityMonths: number | null;
  cost: number | null;
  costCurrency: Currency | null;
  estHours: number | null;
  status: RecordStatus;
  progress: number;
  plannedExamDate: string | null;
  issuedDate: string | null;
  certificateUrl: string | null;
  hasEvidence: boolean;
  viaCompany: boolean;
  refundStatus: RefundStatus;
  notes: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  expiryStatus: string | null;
};

const COLUMNS =
  "id, member_id, member_code, member_name, member_email, team_id, team_name, certificate_id, certificate_name, certificate_kind, course_id, course_name, cert_type_name, provider_name, validity_months, cost, cost_currency, est_hours, status, progress, planned_exam_date, issued_date, certificate_url, evidence_path, via_company, refund_status, notes, expiry_date, days_to_expiry, expiry_status";

/** RLS decides what comes back: everything for Admin, managed teams (+ own) for Manager, own for Member. */
export async function listRecords(filter: { memberId?: string } = {}): Promise<RecordRow[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) => {
    let query = supabase.from("v_training_records").select(COLUMNS);
    if (filter.memberId) query = query.eq("member_id", filter.memberId);
    // `id` makes the order total, which paging needs.
    return query.order("member_name").order("certificate_name").order("id").range(from, to);
  });

  // Generated view types are all-nullable; the underlying columns are NOT NULL.
  return rows.flatMap((row) =>
    row.id && row.member_id && row.certificate_id && row.status
      ? [
          {
            id: row.id,
            memberId: row.member_id,
            memberCode: row.member_code ?? "",
            memberName: row.member_name ?? "",
            memberEmail: row.member_email ?? "",
            teamId: row.team_id,
            teamName: row.team_name,
            certificateId: row.certificate_id,
            certificateName: row.certificate_name ?? "",
            certificateKind: row.certificate_kind ?? "exam",
            courseId: row.course_id,
            courseName: row.course_name,
            certTypeName: row.cert_type_name,
            providerName: row.provider_name,
            validityMonths: row.validity_months,
            cost: row.cost,
            costCurrency: toCurrency(row.cost_currency),
            estHours: row.est_hours,
            status: row.status,
            progress: row.progress ?? 0,
            plannedExamDate: row.planned_exam_date,
            issuedDate: row.issued_date,
            certificateUrl: row.certificate_url,
            // The storage key never goes to the client; it is resolved server-side on demand.
            hasEvidence: row.evidence_path != null,
            viaCompany: row.via_company ?? false,
            refundStatus: row.refund_status ?? "n_a",
            notes: row.notes,
            expiryDate: row.expiry_date,
            daysToExpiry: row.days_to_expiry,
            expiryStatus: row.expiry_status,
          },
        ]
      : [],
  );
}

/** Members the caller may create a record for — the `members` select policy already matches the record insert policy. */
export async function listMemberOptions() {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase.from("members").select("id, code, full_name").eq("is_active", true).order("full_name").order("id").range(from, to),
  );
  return rows.map((row) => ({ id: row.id, label: row.full_name, hint: row.code }));
}

/** Every certificate a record can be for, with the kind in the label so "Exam" and "Course completion" are told apart. */
export async function listCertificateOptions(): Promise<CertificateChoice[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("certificates")
      .select("id, name, kind, providers(name), granting:courses!certificates_course_id_fkey(id, name)")
      .order("name")
      .order("id")
      .range(from, to),
  );
  return rows.map((row) => ({
    id: row.id,
    label: `${row.name} · ${CERTIFICATE_KIND_LABEL[row.kind]}`,
    hint: row.providers?.name ?? undefined,
    kind: row.kind,
    grantingCourse: row.granting ? { id: row.granting.id, name: row.granting.name } : null,
  }));
}

/** Courses that prepare for an exam: the choices for "Course studied". */
export async function listStudyCourses(): Promise<StudyCourse[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase.from("courses").select("id, name, prepares_for_id").not("prepares_for_id", "is", null).order("name").order("id").range(from, to),
  );
  return rows.flatMap((row) => (row.prepares_for_id ? [{ id: row.id, name: row.name, preparesForId: row.prepares_for_id }] : []));
}
