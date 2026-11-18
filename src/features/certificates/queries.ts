import type { CertificateKind } from "@/features/certificates/schema";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
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
  catalogueStatus: "approved" | "pending" | "rejected";
  proposedProvider?: string | null;
  proposalReason?: string | null;
};

export async function listCertificates(): Promise<CertificateRow[]> {
  const supabase = await createClient();
  const data = await fetchAllRows((from, to) =>
    supabase
      .from("certificates")
      .select(
        "id, name, kind, cert_type_id, provider_id, proposed_provider, proposal_reason, catalogue_status, level, validity_months, url, course_id, cert_types(name), providers(name), granting:courses!certificates_course_id_fkey(name)",
      )
      .order("name")
      .order("id")
      .range(from, to),
  );
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    certTypeId: row.cert_type_id,
    certTypeName: row.cert_types?.name ?? "—",
    providerId: row.provider_id,
    providerName: row.providers?.name ?? row.proposed_provider ?? "—",
    level: row.level,
    validityMonths: row.validity_months,
    url: row.url,
    courseId: row.course_id,
    courseName: row.granting?.name ?? null,
    catalogueStatus: (row.catalogue_status as "approved" | "pending" | "rejected") ?? "approved",
    proposedProvider: row.proposed_provider,
    proposalReason: row.proposal_reason,
  }));
}
