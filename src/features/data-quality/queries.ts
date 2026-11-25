import { parseIssues, type IssueRow } from "@/features/data-quality/schema";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

/** RLS and the view decide the scope: Admin everything, Manager their teams' records, Member their own. */
export async function listDataQualityIssues(): Promise<IssueRow[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("v_data_quality_issues")
      .select("issue_type, severity, subject_id, member_id, member_code, member_name, team_name, certificate_name, record_id, since, days")
      // (issue_type, subject_id) is unique, so the order is total and paging cannot repeat or skip rows.
      .order("issue_type")
      .order("subject_id")
      .range(from, to),
  );
  const parsed = parseIssues(rows);
  const certProposalIds = parsed.filter((r) => r.type === "certificate_proposal").map((r) => r.subjectId);
  const courseProposalIds = parsed.filter((r) => r.type === "course_proposal").map((r) => r.subjectId);
  if (certProposalIds.length === 0 && courseProposalIds.length === 0) return parsed;

  const [certMeta, courseMeta] = await Promise.all([
    certProposalIds.length > 0
      ? supabase
          .from("certificates")
          .select("id, kind, proposed_provider, providers(name)")
          .in("id", certProposalIds)
      : Promise.resolve({ data: null }),
    courseProposalIds.length > 0
      ? supabase
          .from("courses")
          .select("id, proposed_provider, providers(name)")
          .in("id", courseProposalIds)
      : Promise.resolve({ data: null }),
  ]);

  const certById = new Map(
    (certMeta.data ?? []).map((c) => [
      c.id,
      {
        kind: c.kind as "exam" | "completion",
        providerName: c.providers?.name ?? c.proposed_provider ?? null,
      },
    ]),
  );
  const courseById = new Map(
    (courseMeta.data ?? []).map((c) => [
      c.id,
      {
        providerName: c.providers?.name ?? c.proposed_provider ?? null,
      },
    ]),
  );

  return parsed.map((row) => {
    if (row.type === "certificate_proposal") {
      const meta = certById.get(row.subjectId);
      if (meta) return { ...row, certificateKind: meta.kind, providerName: meta.providerName };
    } else if (row.type === "course_proposal") {
      const meta = courseById.get(row.subjectId);
      if (meta) return { ...row, providerName: meta.providerName };
    }
    return row;
  });
}
