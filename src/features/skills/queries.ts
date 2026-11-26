import "server-only";
import { z } from "zod";
import type { CurrentUser } from "@/features/auth/queries";
import { formatYoe } from "@/features/career/format";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { createClient } from "@/lib/supabase/server";
import { resolveSkillVerification, toVerificationStatus } from "./metrics";
import type {
  CertifiedProof,
  MemberSkillSummary,
  PendingSkillReview,
  RoleBenchmark,
  Skill,
  SkillCategory,
  SkillLevel,
  SkillsWorkspaceData,
  VerificationStatus,
} from "./types";

const VALID_EXPIRY_STATUSES = ["Active", "Expiring in 60d", "Expiring Soon", "No Expiry"] as const;
const VALID_EXPIRY_SET = new Set<string>(VALID_EXPIRY_STATUSES);

const VALID_CATEGORIES = new Set<SkillCategory>([
  "cloud",
  "backend",
  "frontend",
  "mobile",
  "devops",
  "security",
  "data_ai",
  "embedded",
  "leadership",
]);

function toSkillCategory(slug: string | null | undefined): SkillCategory {
  if (slug && VALID_CATEGORIES.has(slug as SkillCategory)) {
    return slug as SkillCategory;
  }
  return "backend";
}

function clampSkillLevel(level: number | null | undefined): SkillLevel {
  if (typeof level !== "number" || !Number.isFinite(level)) return 0;
  const rounded = Math.round(level);
  if (rounded <= 0) return 0;
  if (rounded >= 5) return 5;
  return rounded as SkillLevel;
}

type ValidRecordRow = {
  id: string;
  certificate_id: string;
  certificate_name: string | null;
  provider_name: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  expiry_status: string | null;
  evidence_path: string | null;
  certificate_url: string | null;
  status: string | null;
  approval: string | null;
  renewed: boolean | null;
};

type SkillCertLinkRow = {
  skill_id: string;
  certificate_id: string;
  proves_level: number;
  certificates: { level: string | null } | null;
};

async function fetchValidApprovedRecords(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberId: string,
): Promise<ValidRecordRow[]> {
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("v_training_records")
      .select(
        "id, certificate_id, certificate_name, provider_name, issued_date, expiry_date, expiry_status, evidence_path, certificate_url, status, approval, renewed",
      )
      .eq("member_id", memberId)
      .eq("status", "done")
      .eq("approval", "approved")
      .eq("renewed", false)
      .in("expiry_status", [...VALID_EXPIRY_STATUSES])
      .order("id")
      .range(from, to),
  );

  // Defensive re-check alongside SQL filters so unapproved, renewed, or expired rows never count.
  return rows.flatMap((row) =>
    row.id &&
    row.certificate_id &&
    row.status === "done" &&
    row.approval === "approved" &&
    row.renewed === false &&
    VALID_EXPIRY_SET.has(row.expiry_status ?? "")
      ? [row as ValidRecordRow]
      : [],
  );
}

type ProofCandidate = {
  provesLevel: number;
  verifiedDate: string;
  recordId: string;
  proof: CertifiedProof;
};

function isHigherPriorityProof(next: ProofCandidate, current: ProofCandidate): boolean {
  if (next.provesLevel !== current.provesLevel) {
    return next.provesLevel > current.provesLevel;
  }
  const dateCmp = next.verifiedDate.localeCompare(current.verifiedDate);
  if (dateCmp !== 0) {
    return dateCmp > 0;
  }
  return next.recordId.localeCompare(current.recordId) > 0;
}

function deriveCertifiedProofs(
  records: ValidRecordRow[],
  links: SkillCertLinkRow[],
): Map<string, CertifiedProof> {
  const bestBySkillId = new Map<string, ProofCandidate>();
  if (records.length === 0 || links.length === 0) {
    return new Map();
  }

  const recordsByCertId = new Map<string, ValidRecordRow[]>();
  for (const rec of records) {
    const list = recordsByCertId.get(rec.certificate_id) ?? [];
    list.push(rec);
    recordsByCertId.set(rec.certificate_id, list);
  }

  for (const link of links) {
    const matchingRecords = recordsByCertId.get(link.certificate_id);
    if (!matchingRecords) continue;

    for (const rec of matchingRecords) {
      const verifiedDate = rec.issued_date ?? "";
      const candidate: ProofCandidate = {
        provesLevel: link.proves_level,
        verifiedDate,
        recordId: rec.id,
        proof: {
          certificateName: rec.certificate_name ?? "",
          certificateCode: link.certificates?.level ?? "",
          issuer: rec.provider_name ?? "—",
          verifiedDate,
          expiryDate: rec.expiry_date,
          credentialUrl: rec.evidence_path
            ? `/api/records/${rec.id}/evidence`
            : (rec.certificate_url ?? undefined),
          recordId: rec.id,
        },
      };

      const existing = bestBySkillId.get(link.skill_id);
      if (!existing || isHigherPriorityProof(candidate, existing)) {
        bestBySkillId.set(link.skill_id, candidate);
      }
    }
  }

  const result = new Map<string, CertifiedProof>();
  for (const [skillId, candidate] of bestBySkillId) {
    result.set(skillId, candidate.proof);
  }
  return result;
}

function buildBenchmark(
  careerRoleName: string | null | undefined,
  teamName: string | null | undefined,
  yoeYears: number | null | undefined,
): RoleBenchmark {
  const hasYoe = yoeYears !== null && yoeYears !== undefined;
  const experienceLevel = hasYoe ? `${formatYoe(yoeYears)} of experience` : "Experience not set";
  return {
    roleName: careerRoleName ?? "Role not set",
    teamName: teamName ?? "No team assigned",
    experienceLevel,
    description: hasYoe
      ? `${experienceLevel}. Rate skills from 0 to 5 and keep certificates linked for verified status.`
      : "Rate skills from 0 to 5 and keep certificates linked for verified status.",
  };
}

/**
 * Loads the `/skills` workspace for the target member (or the signed-in user) under caller RLS.
 * Returns `{ status: "not_found" }` when the member does not exist or is outside the caller's scope.
 */
export async function loadSkillsWorkspace({
  viewer,
  targetMemberId,
}: {
  viewer: Pick<CurrentUser, "role" | "memberId">;
  targetMemberId?: string | null;
}): Promise<SkillsWorkspaceData> {
  const targetId = targetMemberId ?? viewer.memberId;
  if (!targetId || !z.guid().safeParse(targetId).success) {
    return { status: "not_found" };
  }

  const supabase = await createClient();
  const isManagerOrAdmin = viewer.role === "admin" || viewer.role === "manager";

  const [
    memberRes,
    careerRes,
    domainsRes,
    skillsRows,
    memberSkillRows,
    validRecords,
    certLinkRows,
    pendingReviews,
  ] = await Promise.all([
    supabase.from("members").select("id, code, full_name, teams(name)").eq("id", targetId).maybeSingle(),
    supabase
      .from("v_member_profiles")
      .select("career_role_name, yoe_years")
      .eq("member_id", targetId)
      .maybeSingle(),
    supabase.from("skill_domains").select("id, name, slug, sort_order").order("sort_order").order("id"),
    fetchAllRows((from, to) =>
      supabase
        .from("skills")
        .select("id, code, name, domain_id, description, sort_order")
        .order("sort_order")
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("member_skills")
        .select(
          "id, skill_id, current_level, years_of_experience, verification_status, evidence_note, last_evaluated_at, reviewed_by, reviewed_at, review_note, reviewer:members!member_skills_reviewed_by_fkey(full_name)",
        )
        .eq("member_id", targetId)
        .order("id")
        .range(from, to),
    ),
    fetchValidApprovedRecords(supabase, targetId),
    fetchAllRows((from, to) =>
      supabase
        .from("skill_certificate_links")
        .select("skill_id, certificate_id, proves_level, certificates(level)")
        .order("id")
        .range(from, to),
    ),
    isManagerOrAdmin ? listPendingSkillReviews(viewer.memberId) : Promise.resolve([]),
  ]);

  if (memberRes.error) throw new Error(memberRes.error.message);
  if (!memberRes.data) return { status: "not_found" };
  if (careerRes.error) throw new Error(careerRes.error.message);
  if (domainsRes.error) throw new Error(domainsRes.error.message);

  const domainSlugById = new Map<string, SkillCategory>();
  for (const domain of domainsRes.data) {
    domainSlugById.set(domain.id, toSkillCategory(domain.slug));
  }

  const memberSkillBySkillId = new Map(memberSkillRows.map((row) => [row.skill_id, row]));
  const proofBySkillId = deriveCertifiedProofs(validRecords, certLinkRows as SkillCertLinkRow[]);

  const catalogSkills: Skill[] = skillsRows.map((row) => {
    const category = domainSlugById.get(row.domain_id) ?? "backend";
    const saved = memberSkillBySkillId.get(row.id);
    const certifiedProof = proofBySkillId.get(row.id);

    if (!saved) {
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        category,
        description: row.description,
        currentLevel: 0,
        verification: "self_assessed",
        certifiedProof,
        yearsOfExperience: 0,
        lastEvaluatedAt: "",
        isSaved: false,
      };
    }

    const currentLevel = clampSkillLevel(saved.current_level);
    const verification = resolveSkillVerification({
      currentLevel,
      dbStatus: toVerificationStatus(saved.verification_status),
      hasCertifiedProof: certifiedProof !== undefined,
    });

    return {
      id: row.id,
      code: row.code,
      name: row.name,
      category,
      description: row.description,
      currentLevel,
      verification,
      certifiedProof,
      yearsOfExperience: Number(saved.years_of_experience ?? 0),
      lastEvaluatedAt: saved.last_evaluated_at,
      evidenceNote: saved.evidence_note ?? undefined,
      reviewNote: saved.review_note ?? undefined,
      reviewedByName: saved.reviewer?.full_name ?? undefined,
      reviewedAt: saved.reviewed_at ?? undefined,
      isSaved: true,
    };
  });

  const profileSkills = catalogSkills.filter((skill) => skill.isSaved);
  const teamName = memberRes.data.teams?.name ?? null;
  const isOwnProfile = targetId === viewer.memberId;

  return {
    status: "ok",
    targetMember: {
      id: memberRes.data.id,
      code: memberRes.data.code,
      fullName: memberRes.data.full_name,
      teamName,
    },
    benchmark: buildBenchmark(careerRes.data?.career_role_name, teamName, careerRes.data?.yoe_years),
    profileSkills,
    catalogSkills,
    canEdit: isOwnProfile,
    canReview: viewer.role === "admin" || (viewer.role === "manager" && !isOwnProfile),
    isOwnProfile,
    pendingReviews,
  };
}

/**
 * Lists Level 5 skill requests awaiting review under caller RLS.
 * Excludes `viewerMemberId` when provided so Managers never see their own Level 5 request.
 */
export async function listPendingSkillReviews(
  viewerMemberId: string | null,
): Promise<PendingSkillReview[]> {
  const supabase = await createClient();
  const hasViewerMemberId = Boolean(viewerMemberId && z.guid().safeParse(viewerMemberId).success);

  const rows = await fetchAllRows((from, to) => {
    let query = supabase
      .from("member_skills")
      .select(
        "id, member_id, skill_id, years_of_experience, evidence_note, last_evaluated_at, member:members!member_skills_member_id_fkey(id, code, full_name, teams(name)), skill:skills!member_skills_skill_id_fkey(id, code, name, skill_domains(slug))",
      )
      .eq("verification_status", "pending_review")
      .eq("current_level", 5);

    if (hasViewerMemberId && viewerMemberId) {
      query = query.neq("member_id", viewerMemberId);
    }

    return query.order("last_evaluated_at", { ascending: true }).order("id").range(from, to);
  });

  return rows.flatMap((row) =>
    row.member && row.skill
      ? [
          {
            id: row.id,
            memberId: row.member_id,
            memberCode: row.member.code,
            memberName: row.member.full_name,
            teamName: row.member.teams?.name ?? null,
            skillId: row.skill_id,
            skillCode: row.skill.code,
            skillName: row.skill.name,
            category: toSkillCategory(row.skill.skill_domains?.slug),
            evidenceNote: row.evidence_note ?? null,
            yearsOfExperience: Number(row.years_of_experience ?? 0),
            lastEvaluatedAt: row.last_evaluated_at,
          },
        ]
      : [],
  );
}

/**
 * Counts pending Level 5 skill reviews per member for `/members` badges under caller RLS.
 */
export async function listPendingSkillReviewCounts(
  viewerMemberId?: string | null,
): Promise<Map<string, number>> {
  const supabase = await createClient();
  const hasViewerMemberId = Boolean(viewerMemberId && z.guid().safeParse(viewerMemberId).success);

  const rows = await fetchAllRows((from, to) => {
    let query = supabase
      .from("member_skills")
      .select("member_id")
      .eq("verification_status", "pending_review")
      .eq("current_level", 5);

    if (hasViewerMemberId && viewerMemberId) {
      query = query.neq("member_id", viewerMemberId);
    }

    return query.order("id").range(from, to);
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.member_id, (counts.get(row.member_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Lightweight summary for the Member Dashboard `SkillsMatrixCard` using live certificate proof.
 */
export async function loadMemberSkillSummary(memberId: string): Promise<MemberSkillSummary> {
  if (!z.guid().safeParse(memberId).success) {
    return {
      totalSkills: 0,
      certifiedCount: 0,
      pendingReviewCount: 0,
      returnedCount: 0,
      averageLevel: 0,
    };
  }

  const supabase = await createClient();
  const [memberSkillRows, validRecords] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("member_skills")
        .select("skill_id, current_level, verification_status")
        .eq("member_id", memberId)
        .order("id")
        .range(from, to),
    ),
    fetchValidApprovedRecords(supabase, memberId),
  ]);

  if (memberSkillRows.length === 0) {
    return {
      totalSkills: 0,
      certifiedCount: 0,
      pendingReviewCount: 0,
      returnedCount: 0,
      averageLevel: 0,
    };
  }

  let certLinks: SkillCertLinkRow[] = [];
  if (validRecords.length > 0) {
    const certIds = [...new Set(validRecords.map((rec) => rec.certificate_id))];
    const rows = await fetchAllRows((from, to) =>
      supabase
        .from("skill_certificate_links")
        .select("skill_id, certificate_id, proves_level, certificates(level)")
        .in("certificate_id", certIds)
        .order("id")
        .range(from, to),
    );
    certLinks = rows as SkillCertLinkRow[];
  }

  const proofBySkillId = deriveCertifiedProofs(validRecords, certLinks);

  let certifiedCount = 0;
  let pendingReviewCount = 0;
  let returnedCount = 0;
  let sumLevel = 0;

  for (const row of memberSkillRows) {
    const currentLevel = clampSkillLevel(row.current_level);
    sumLevel += currentLevel;
    const verification = resolveSkillVerification({
      currentLevel,
      dbStatus: toVerificationStatus(row.verification_status),
      hasCertifiedProof: proofBySkillId.has(row.skill_id),
    });

    if (verification === "certified") certifiedCount++;
    else if (verification === "pending_review") pendingReviewCount++;
    else if (verification === "returned") returnedCount++;
  }

  const totalSkills = memberSkillRows.length;
  return {
    totalSkills,
    certifiedCount,
    pendingReviewCount,
    returnedCount,
    averageLevel: Math.round((sumLevel / totalSkills) * 10) / 10,
  };
}
