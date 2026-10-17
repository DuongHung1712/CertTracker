import { parseIssues, type IssueRow } from "@/features/data-quality/schema";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

/** RLS and the view decide the scope: Admin everything, Manager their teams' records, Member their own. */
export async function listDataQualityIssues(): Promise<IssueRow[]> {
  const supabase = await createClient();
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("v_data_quality_issues")
      .select("issue_type, severity, subject_id, member_id, member_code, member_name, team_name, course_name, record_id, since, days")
      // (issue_type, subject_id) is unique, so the order is total and paging cannot repeat or skip rows.
      .order("issue_type")
      .order("subject_id")
      .range(from, to),
  );
  return parseIssues(rows);
}
