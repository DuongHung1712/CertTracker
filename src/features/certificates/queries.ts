import type { CertificateKind } from "@/features/certificates/schema";
import { createClient } from "@/lib/supabase/server";

export type CertificateRow = {
  id: string;
  name: string;
  kind: CertificateKind;
  certTypeId: string | null;
  certTypeName: string;
  providerId: string | null;
  providerName: string;
  level: string | null;
  validityMonths: number | null;
  url: string | null;
  courseId: string | null;
  courseName: string | null;
};

export async function listCertificates(): Promise<CertificateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select(
      "id, name, kind, cert_type_id, provider_id, level, validity_months, url, course_id, cert_types(name), providers(name), granting:courses!certificates_course_id_fkey(name)",
    )
    .order("name")
    .order("id");
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    certTypeId: row.cert_type_id,
    certTypeName: row.cert_types?.name ?? "—",
    providerId: row.provider_id,
    providerName: row.providers?.name ?? "—",
    level: row.level,
    validityMonths: row.validity_months,
    url: row.url,
    courseId: row.course_id,
    courseName: row.granting?.name ?? null,
  }));
}
