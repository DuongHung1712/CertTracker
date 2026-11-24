"use server";

import { revalidatePath } from "next/cache";
import {
  CERTIFICATE_KIND_NOUN,
  certificateDuplicateMessage,
  certificateSchema,
  certificateWithIdSchema,
  proposeCertificateSchema,
  type CertificateInput,
  type CertificateKind,
  type ProposeCertificateInput,
} from "@/features/certificates/schema";
import type { CertificateChoice } from "@/features/records/certificate-course";
import { idSchema } from "@/features/courses/schema";
import { assertAffected } from "@/lib/assert-affected";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

/** A kind change is only refused when the target is a completion, so the target kind names the thing. */
const kindChangeBlocked = (kind: CertificateKind): string =>
  `This ${CERTIFICATE_KIND_NOUN[kind]} has records with another course. Change them first.`;

function toRow(data: CertificateInput) {
  return {
    kind: data.kind,
    name: data.name,
    cert_type_id: data.certTypeId,
    provider_id: data.providerId,
    level: data.level || null,
    validity_months: data.validityMonths,
    url: data.url,
    course_id: data.courseId,
  };
}

const duplicate = (data: CertificateInput) => certificateDuplicateMessage(data.kind, data.name);

export async function createCertificate(input: CertificateInput): Promise<Result<null>> {
  const parsed = certificateSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const supabase = await createClient();
  const { error } = await supabase.from("certificates").insert(toRow(parsed.data));
  if (error) return err(mapPostgresError(error, { duplicate: duplicate(parsed.data) }));
  revalidatePath("/courses");
  return ok(null);
}

/**
 * Spec Q6: a completion must not be left with a record that studied another course than the one that grants it,
 * whether the certificate was an exam or already a completion whose course changes. A completion becoming an exam is
 * always allowed: old records keep their course (the trigger only fires when a record's certificate or course
 * changes). Returns null when a read fails.
 */
async function grantingCourseFitsRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  data: CertificateInput,
): Promise<boolean | null> {
  if (data.kind !== "completion") return true;
  // Ask for one conflicting record instead of reading them all: PostgREST caps a plain select at 1000 rows.
  const conflicting = await supabase
    .from("training_records")
    .select("id")
    .eq("certificate_id", id)
    .not("course_id", "is", null)
    .neq("course_id", data.courseId)
    .limit(1);
  if (conflicting.error) return null;
  return conflicting.data.length === 0;
}

export async function updateCertificate(input: CertificateInput & { id: string }): Promise<Result<null>> {
  const parsed = certificateWithIdSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");
  const { id, ...data } = parsed.data;
  const supabase = await createClient();
  const safe = await grantingCourseFitsRecords(supabase, id, data);
  if (safe === null) return err("Something went wrong. Try again.");
  if (!safe) return err(kindChangeBlocked(data.kind));
  const { data: rows, error } = await supabase.from("certificates").update(toRow(data)).eq("id", id).select("id");
  if (error) return err(mapPostgresError(error, { duplicate: duplicate(data) }));
  const guard = assertAffected(rows);
  if (guard) return guard;
  revalidatePath("/courses");
  revalidatePath("/records");
  return ok(null);
}

export async function deleteCertificate(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.from("certificates").delete().eq("id", parsed.data.id).select("id");
  if (error) return err(mapPostgresError(error, { restricted: "Members already hold this. Delete their entries first." }));
  const guard = assertAffected(data);
  if (guard) return guard;
  revalidatePath("/courses");
  return ok(null);
}

export async function proposeCertificate(input: ProposeCertificateInput): Promise<Result<CertificateChoice>> {
  const parsed = proposeCertificateSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in to propose a certificate.");

  // Get the caller's member_id from profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("member_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.member_id) {
    return err("Your account is not linked to a member profile.");
  }

  // Anti-duplicate check: reject if an approved or pending entry already exists with identical name
  const trimmedName = parsed.data.name.trim();
  const escapedName = trimmedName.replace(/[%_\\]/g, "\\$&");
  const { data: existing } = await supabase
    .from("certificates")
    .select("id, name, kind, catalogue_status")
    .ilike("name", escapedName)
    .in("catalogue_status", ["approved", "pending"])
    .limit(1);

  const duplicateItem = Array.isArray(existing) ? existing[0] : existing;
  if (duplicateItem) {
    if (duplicateItem.catalogue_status === "pending") {
      return err(
        `This ${CERTIFICATE_KIND_NOUN[duplicateItem.kind as CertificateKind] ?? "certificate"} has already been proposed and is awaiting approval ("${duplicateItem.name}"). Choose it from the list.`,
      );
    }
    return err(`This certificate is already in the Catalogue ("${duplicateItem.name}"). Choose it from the list.`);
  }

  const { data: inserted, error } = await supabase
    .from("certificates")
    .insert({
      name: trimmedName,
      kind: parsed.data.kind,
      provider_id: parsed.data.providerId ?? null,
      proposed_provider: parsed.data.proposedProvider ?? null,
      url: parsed.data.url ?? null,
      proposal_reason: parsed.data.reason ?? null,
      catalogue_status: "pending",
      proposed_by: profile.member_id,
    })
    .select("id, name, kind, provider_id, proposed_provider, catalogue_status, providers(name)")
    .single();

  if (error) {
    return err(
      mapPostgresError(error, {
        duplicate: "A certificate with this name and provider already exists in the Catalogue or has been proposed.",
      }),
    );
  }
  if (!inserted) return err("Could not propose certificate");

  revalidatePath("/me");
  revalidatePath("/dashboard");
  revalidatePath("/courses");
  revalidatePath("/records");

  const choice: CertificateChoice = {
    id: inserted.id,
    label: inserted.name,
    hint: (inserted.providers as { name: string } | null)?.name ?? inserted.proposed_provider ?? undefined,
    kind: inserted.kind,
    grantingCourse: null,
    catalogueStatus: "pending",
  };

  return ok(choice);
}

export async function approveCertificate(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");

  const supabase = await createClient();
  // One transaction in SQL: creates the typed provider and, for a course completion, the course that grants it.
  const { error } = await supabase.rpc("approve_certificate", { p_id: parsed.data.id });
  if (error?.code === "P0002") return err("This proposal was already reviewed. Refresh the page.");
  if (error) return err(mapPostgresError(error, { duplicate: "The Catalogue already has an item with this name and provider: delete the proposal and use that one." }));

  revalidateProposalViews();
  return ok(null);
}

export async function rejectCertificate(input: { id: string }): Promise<Result<null>> {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_certificate", { p_id: parsed.data.id });
  if (error?.code === "P0002") return err("This proposal was already reviewed. Refresh the page.");
  if (error?.code === "42501") return err("Only an admin can reject a proposal.");
  if (error) return err(mapPostgresError(error));

  revalidateProposalViews();
  return ok(null);
}

/** Every screen that shows a proposal: the Catalogue, Data Quality, the member's own lists and the Dashboard. */
function revalidateProposalViews() {
  for (const path of ["/courses", "/data-quality", "/records", "/me", "/dashboard"]) revalidatePath(path);
}
