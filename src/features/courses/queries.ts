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
      "id, name, cert_type_id, provider_id, level, validity_months, refundable, cost, est_hours, url, cert_types(name), providers(name)",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    certTypeId: row.cert_type_id,
    certTypeName: row.cert_types?.name ?? "—",
    providerId: row.provider_id,
    providerName: row.providers?.name ?? "—",
    level: row.level,
    validityMonths: row.validity_months,
    refundable: row.refundable,
    cost: row.cost,
    estHours: row.est_hours,
    url: row.url,
  }));
}
