import {
  parseBreakdown, parseKpis, parseRanking,
  type BreakdownDimension, type BreakdownRow, type DashboardKpis, type RankingRow,
} from "@/features/dashboard/schema";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";

/** Org-wide counts for any signed-in role (SECURITY DEFINER function, numbers only). */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_kpis");
  if (error) throw new Error(error.message);
  return parseKpis(data);
}

export async function getBreakdown(dimension: BreakdownDimension, limit?: number): Promise<BreakdownRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_breakdown", {
    p_dimension: dimension,
    ...(limit ? { p_limit: limit } : {}),
  });
  if (error) throw new Error(error.message);
  return parseBreakdown(data);
}

/** Admin/Manager only — the function refuses other roles; RLS scopes Manager to their teams. */
export async function getRanking(): Promise<RankingRow[]> {
  const supabase = await createClient();
  // The function returns a total order (rank, name, id), which paging needs.
  const rows = await fetchAllRows((from, to) => supabase.rpc("dashboard_ranking").range(from, to));
  return parseRanking(rows);
}
