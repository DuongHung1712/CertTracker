"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/features/auth/queries";
import { assertAffected } from "@/lib/assert-affected";
import { todayVn } from "@/lib/dates";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";
import {
  batchSaveSkillAssessmentsSchema,
  quickRateSkillSchema,
  removeMemberSkillSchema,
  reviewMemberSkillSchema,
  updateSkillAssessmentSchema,
  type BatchSaveSkillAssessmentsInput,
  type QuickRateSkillInput,
  type RemoveMemberSkillInput,
  type ReviewMemberSkillInput,
  type UpdateSkillAssessmentInput,
} from "./schema";
import { toVerificationStatus } from "./metrics";
import type { SkillLevel, VerificationStatus } from "./types";

const SKILL_ERROR_MESSAGES = {
  duplicate: "This skill is already in your profile.",
  restricted: "The skill or member no longer exists. Reload the page and try again.",
  invalid: "Check the level, years of experience, and notes, then try again.",
};

const REVIEW_FORBIDDEN_MESSAGE = "Only a manager in scope or an admin can review this skill.";
const REVIEW_NOT_PENDING_MESSAGE =
  "Only a pending Level 5 request can be approved or returned. Refresh and try again.";
const REVIEW_NOTE_MESSAGE = "Write what the member should fix.";

function revalidateSkillsPages() {
  revalidatePath("/skills");
  revalidatePath("/dashboard");
  revalidatePath("/members");
}

async function requireLinkedMember(): Promise<{ ok: true; memberId: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to continue." };
  if (!user.memberId) return { ok: false, error: "Your account is not linked to a member yet." };
  return { ok: true, memberId: user.memberId };
}

async function writeOwnSkillRating({
  memberId,
  skillId,
  level,
  extra,
}: {
  memberId: string;
  skillId: string;
  level: SkillLevel;
  extra?: { yearsOfExperience: number; evidenceNote: string | null };
}): Promise<Result<{ id: string; verificationStatus: VerificationStatus }>> {
  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("member_skills")
    .select("id, current_level, verification_status")
    .eq("member_id", memberId)
    .eq("skill_id", skillId)
    .maybeSingle();
  if (readError) return err(mapPostgresError(readError, SKILL_ERROR_MESSAGES));

  const today = todayVn();

  if (existing) {
    const keepEndorsed =
      existing.current_level === 5 && existing.verification_status === "certified" && level === 5;
    const nextStatus: VerificationStatus =
      level === 5 ? (keepEndorsed ? "certified" : "pending_review") : "self_assessed";

    const { data: rows, error } = await supabase
      .from("member_skills")
      .update({
        current_level: level,
        verification_status: nextStatus,
        manager_endorsement_requested: level === 5 && !keepEndorsed,
        last_evaluated_at: today,
        ...(extra
          ? {
              years_of_experience: extra.yearsOfExperience,
              evidence_note: extra.evidenceNote,
            }
          : {}),
      })
      .eq("id", existing.id)
      .select("id, verification_status");

    if (error) return err(mapPostgresError(error, SKILL_ERROR_MESSAGES));
    const guard = assertAffected(rows);
    if (guard && !guard.ok) return err(guard.error);

    revalidateSkillsPages();
    const saved = rows![0];
    return ok({
      id: saved.id,
      verificationStatus: toVerificationStatus(saved.verification_status),
    });
  }

  const nextStatus: VerificationStatus = level === 5 ? "pending_review" : "self_assessed";
  const { data: saved, error } = await supabase
    .from("member_skills")
    .upsert(
      {
        member_id: memberId,
        skill_id: skillId,
        current_level: level,
        years_of_experience: extra ? extra.yearsOfExperience : 0,
        evidence_note: extra ? extra.evidenceNote : null,
        verification_status: nextStatus,
        manager_endorsement_requested: level === 5,
        last_evaluated_at: today,
      },
      { onConflict: "member_id,skill_id" },
    )
    .select("id, verification_status")
    .single();

  if (error) return err(mapPostgresError(error, SKILL_ERROR_MESSAGES));
  revalidateSkillsPages();
  return ok({
    id: saved.id,
    verificationStatus: toVerificationStatus(saved.verification_status),
  });
}

/**
 * Sets a member's own competency level (0-5) for one skill while preserving existing YoE and notes.
 */
export async function quickRateSkill(
  input: QuickRateSkillInput,
): Promise<Result<{ id: string; verificationStatus: VerificationStatus }>> {
  const parsed = quickRateSkillSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const auth = await requireLinkedMember();
  if (!auth.ok) return err(auth.error);

  return writeOwnSkillRating({
    memberId: auth.memberId,
    skillId: parsed.data.skillId,
    level: parsed.data.level as SkillLevel,
  });
}

/**
 * Saves full skill assessment details (level, years of experience, and optional evidence note).
 */
export async function saveSkillAssessment(
  input: UpdateSkillAssessmentInput,
): Promise<Result<{ id: string; verificationStatus: VerificationStatus }>> {
  const parsed = updateSkillAssessmentSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const auth = await requireLinkedMember();
  if (!auth.ok) return err(auth.error);

  const level = (parsed.data.newLevel ?? parsed.data.currentLevel) as SkillLevel;
  const roundedYoe = Math.round(parsed.data.yearsOfExperience * 10) / 10;
  const evidenceNote =
    parsed.data.evidenceNote && parsed.data.evidenceNote.length > 0 ? parsed.data.evidenceNote : null;

  return writeOwnSkillRating({
    memberId: auth.memberId,
    skillId: parsed.data.skillId,
    level,
    extra: { yearsOfExperience: roundedYoe, evidenceNote },
  });
}

/**
 * Batch-saves changed skill ratings in a single upsert while preserving existing YoE, notes,
 * and unchanged manager-endorsed Level 5 rows.
 */
export async function batchSaveSkillAssessments(
  input: BatchSaveSkillAssessmentsInput,
): Promise<Result<{ count: number }>> {
  const parsed = batchSaveSkillAssessmentsSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const auth = await requireLinkedMember();
  if (!auth.ok) return err(auth.error);

  const supabase = await createClient();
  const existingRows: {
    skill_id: string;
    current_level: number;
    verification_status: string;
    years_of_experience: number;
    evidence_note: string | null;
  }[] = [];

  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error: readError } = await supabase
      .from("member_skills")
      .select("skill_id, current_level, verification_status, years_of_experience, evidence_note")
      .eq("member_id", auth.memberId)
      .order("id")
      .range(from, to);
    if (readError) return err(mapPostgresError(readError, SKILL_ERROR_MESSAGES));
    if (!data || data.length === 0) break;
    existingRows.push(...data);
    if (data.length < pageSize) break;
  }

  const existingBySkillId = new Map(existingRows.map((row) => [row.skill_id, row]));
  const today = todayVn();

  const upsertRows = parsed.data.items.flatMap((item) => {
    const existing = existingBySkillId.get(item.skillId);
    const keepEndorsed =
      existing?.current_level === 5 && existing.verification_status === "certified" && item.level === 5;
    if (keepEndorsed) return [];

    return [
      {
        member_id: auth.memberId,
        skill_id: item.skillId,
        current_level: item.level,
        years_of_experience: existing ? Number(existing.years_of_experience) : 0,
        evidence_note: existing?.evidence_note ?? null,
        verification_status: item.level === 5 ? "pending_review" : "self_assessed",
        manager_endorsement_requested: item.level === 5,
        last_evaluated_at: today,
      },
    ];
  });

  if (upsertRows.length > 0) {
    const { data: rows, error } = await supabase
      .from("member_skills")
      .upsert(upsertRows, { onConflict: "member_id,skill_id" })
      .select("id");
    if (error) return err(mapPostgresError(error, SKILL_ERROR_MESSAGES));
    const guard = assertAffected(rows);
    if (guard && !guard.ok) return err(guard.error);
  }

  revalidateSkillsPages();
  return ok({ count: parsed.data.items.length });
}

/**
 * Removes a saved skill from the signed-in member's profile.
 */
export async function removeMemberSkill(input: RemoveMemberSkillInput): Promise<Result<null>> {
  const parsed = removeMemberSkillSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const auth = await requireLinkedMember();
  if (!auth.ok) return err(auth.error);

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("member_skills")
    .delete()
    .eq("member_id", auth.memberId)
    .eq("skill_id", parsed.data.skillId)
    .select("id");

  if (error) return err(mapPostgresError(error, SKILL_ERROR_MESSAGES));
  const guard = assertAffected(rows);
  if (guard) return guard;

  revalidateSkillsPages();
  return ok(null);
}

/**
 * Approves or returns a pending Level 5 skill request. RLS and DB triggers enforce
 * manager scope and prevent self-review (`42501`).
 */
export async function reviewMemberSkill(input: ReviewMemberSkillInput): Promise<Result<null>> {
  const parsed = reviewMemberSkillSchema.safeParse(input);
  if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "Invalid data");

  const user = await getCurrentUser();
  if (!user) return err("Sign in again to continue.");

  const { memberId, skillId, decision, note } = parsed.data;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("member_skills")
    .update(
      decision === "approve"
        ? { verification_status: "certified" as const }
        : {
            current_level: 4,
            verification_status: "returned" as const,
            review_note: note!,
          },
    )
    .eq("member_id", memberId)
    .eq("skill_id", skillId)
    .eq("current_level", 5)
    .eq("verification_status", "pending_review")
    .select("id");

  if (error?.code === "42501") return err(REVIEW_FORBIDDEN_MESSAGE);
  if (error) return err(mapPostgresError(error, { invalid: REVIEW_NOTE_MESSAGE }));
  const guard = assertAffected(rows);
  if (guard) return err(REVIEW_NOT_PENDING_MESSAGE);

  revalidateSkillsPages();
  return ok(null);
}
