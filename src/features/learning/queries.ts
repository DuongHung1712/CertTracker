import "server-only";
import type { RecordStatus } from "@/components/status/labels";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

export type CatalogueStatus = "approved" | "pending" | "rejected";

/** One learning item as the lists show it (view v_learning_items, read under the caller's RLS). */
export type LearningRow = {
  id: string;
  memberId: string;
  memberCode: string;
  memberName: string;
  memberEmail: string;
  teamId: string | null;
  teamName: string | null;
  courseId: string | null;
  courseName: string | null;
  providerName: string | null;
  courseCatalogueStatus: CatalogueStatus | null;
  targetCertificateId: string | null;
  targetCertificateName: string | null;
  status: RecordStatus;
  progress: number;
  plannedDate: string | null;
  finishedDate: string | null;
  notes: string | null;
  isSelfStudy: boolean;
};

/** A course a learning item can follow: approved and pending ones, so a proposed course is shared right away (RLS). */
export type CourseOption = { id: string; label: string; hint?: string; catalogueStatus: CatalogueStatus };

const COLUMNS =
  "id, member_id, member_code, member_name, member_email, team_id, team_name, course_id, course_name, provider_name, course_catalogue_status, target_certificate_id, target_certificate_name, status, progress, planned_date, finished_date, notes, is_self_study";

export async function listLearningItems(filter: { memberId?: string } = {}): Promise<LearningRow[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) => {
    let query = supabase.from("v_learning_items").select(COLUMNS).order("created_at", { ascending: false }).order("id");
    if (filter.memberId) query = query.eq("member_id", filter.memberId);
    return query.range(from, to);
  });
  return rows.flatMap((row) =>
    row.id && row.member_id && row.status
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
            courseName: row.course_name,
            providerName: row.provider_name,
            courseCatalogueStatus: (row.course_catalogue_status as CatalogueStatus | null) ?? null,
            targetCertificateId: row.target_certificate_id,
            targetCertificateName: row.target_certificate_name,
            status: row.status,
            progress: row.progress ?? 0,
            plannedDate: row.planned_date,
            finishedDate: row.finished_date,
            notes: row.notes,
            isSelfStudy: row.is_self_study ?? row.course_id === null,
          },
        ]
      : [],
  );
}

export async function listCourseOptions(): Promise<CourseOption[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase.from("courses").select("id, name, catalogue_status, proposed_provider, providers(name)").order("name").order("id").range(from, to),
  );
  return rows
    .filter((row) => row.catalogue_status !== "rejected")
    .map((row) => ({
      id: row.id,
      label: row.name,
      hint: row.providers?.name ?? row.proposed_provider ?? "Self-study",
      catalogueStatus: row.catalogue_status as CatalogueStatus,
    }));
}
