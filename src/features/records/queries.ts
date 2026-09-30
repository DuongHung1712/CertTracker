import type { RecordStatus } from "@/components/status/labels";
import type { RefundStatus } from "@/features/records/schema";
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
  courseId: string;
  courseName: string;
  certTypeName: string | null;
  providerName: string | null;
  validityMonths: number | null;
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
  "id, member_id, member_code, member_name, member_email, team_id, team_name, course_id, course_name, cert_type_name, provider_name, validity_months, status, progress, planned_exam_date, issued_date, certificate_url, evidence_path, via_company, refund_status, notes, expiry_date, days_to_expiry, expiry_status";

/** RLS decides what comes back: everything for Admin, managed teams (+ own) for Manager, own for Member. */
export async function listRecords(filter: { memberId?: string } = {}): Promise<RecordRow[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) => {
    let query = supabase.from("v_training_records").select(COLUMNS);
    if (filter.memberId) query = query.eq("member_id", filter.memberId);
    // `id` makes the order total, which paging needs.
    return query.order("member_name").order("course_name").order("id").range(from, to);
  });

  // Generated view types are all-nullable; the underlying columns are NOT NULL.
  return rows.flatMap((row) =>
    row.id && row.member_id && row.course_id && row.status
      ? [
          {
            id: row.id,
            memberId: row.member_id,
            memberCode: row.member_code ?? "",
            memberName: row.member_name ?? "",
            memberEmail: row.member_email ?? "",
            teamId: row.team_id,
            teamName: row.team_name,
            courseId: row.course_id,
            courseName: row.course_name ?? "",
            certTypeName: row.cert_type_name,
            providerName: row.provider_name,
            validityMonths: row.validity_months,
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

export async function listCourseOptions() {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase.from("courses").select("id, name, providers(name)").order("name").order("id").range(from, to),
  );
  return rows.map((row) => ({ id: row.id, label: row.name, hint: row.providers?.name ?? undefined }));
}
