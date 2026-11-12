import { toCurrency } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export async function listCertTypes() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cert_types").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listProviders() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("providers").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return data;
}

export async function listCourses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select(
      "id, name, provider_id, refundable, cost, cost_currency, est_hours, url, refund_conditions, prepares_for_id, providers(name), prepares_for:certificates!courses_prepares_for_id_fkey(name), grants:certificates!certificates_course_id_fkey(name)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    providerId: row.provider_id,
    providerName: row.providers?.name ?? "—",
    preparesForId: row.prepares_for_id,
    preparesForName: row.prepares_for?.name ?? null,
    // certificates.course_id is unique, so a course grants at most one completion.
    grantsCertificateName: row.grants?.name ?? null,
    refundable: row.refundable,
    cost: row.cost,
    costCurrency: toCurrency(row.cost_currency),
    estHours: row.est_hours,
    url: row.url,
    refundConditions: row.refund_conditions,
  }));
}
