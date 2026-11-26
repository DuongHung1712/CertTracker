import { SKILL_CATEGORIES } from "./schema";
import type {
  Skill,
  SkillCategory,
  SkillFilterOptions,
  SkillLevel,
  SkillSortOption,
  SkillStats,
  VerificationStatus,
} from "./types";
import { todayVn } from "@/lib/dates";
import { foldText } from "@/lib/text";

const VERIFICATION_STATUSES: readonly VerificationStatus[] = ["certified", "self_assessed", "pending_review", "returned"];

/** Narrows a `member_skills.verification_status` string; unknown values read as self-rated. */
export function toVerificationStatus(value: string | null | undefined): VerificationStatus {
  return VERIFICATION_STATUSES.find((status) => status === value) ?? "self_assessed";
}

/**
 * Resolves effective verification status from DB state and live certificate proof.
 * Never trusts DB "certified" for levels 0-4 without valid proof, preserves Level 5
 * pending review, and normalizes stale pre-migration pending_review rows below Level 5.
 */
export function resolveSkillVerification({
  currentLevel,
  dbStatus,
  hasCertifiedProof,
}: {
  currentLevel: SkillLevel;
  dbStatus: VerificationStatus;
  hasCertifiedProof: boolean;
}): VerificationStatus {
  if (dbStatus === "returned") return "returned";
  if (dbStatus === "pending_review") {
    if (currentLevel === 5) return "pending_review";
    return currentLevel > 0 && hasCertifiedProof ? "certified" : "self_assessed";
  }
  if (currentLevel === 5 && dbStatus === "certified") return "certified";
  if (currentLevel > 0 && hasCertifiedProof) return "certified";
  return "self_assessed";
}

/**
 * Applies a new level. Level 5 needs manager review (unless already endorsed at Level 5);
 * otherwise a linked certificate keeps levels 1-4 certified and anything else is self-assessed.
 * Re-rating clears any prior return note.
 */
export function rateSkill(skill: Skill, level: SkillLevel, today: string = todayVn()): Skill {
  const keepEndorsed = level === 5 && skill.currentLevel === 5 && skill.verification === "certified";
  const verification: VerificationStatus =
    level === 5
      ? keepEndorsed
        ? "certified"
        : "pending_review"
      : level > 0 && skill.certifiedProof
        ? "certified"
        : "self_assessed";
  return {
    ...skill,
    currentLevel: level,
    verification,
    lastEvaluatedAt: today,
    reviewNote: undefined,
    ...(keepEndorsed ? {} : { reviewedByName: undefined, reviewedAt: undefined }),
  };
}

export function categoryLabel(category: SkillCategory): string {
  return SKILL_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

/**
 * Calculates a summary of metrics for a set of skills.
 */
export function calculateSkillStats(skills: Skill[]): SkillStats {
  const total = skills.length;
  if (total === 0) {
    return {
      totalSkills: 0,
      certifiedCount: 0,
      selfAssessedCount: 0,
      pendingReviewCount: 0,
      returnedCount: 0,
      averageLevel: 0,
      strongCount: 0,
      certifiedPercentage: 0,
    };
  }

  let certified = 0;
  let selfAssessed = 0;
  let pendingReview = 0;
  let returned = 0;
  let sumLevel = 0;
  let strong = 0;

  for (const s of skills) {
    sumLevel += s.currentLevel;
    if (s.verification === "certified") certified++;
    else if (s.verification === "self_assessed") selfAssessed++;
    else if (s.verification === "pending_review") pendingReview++;
    else if (s.verification === "returned") returned++;

    if (s.currentLevel >= 4) strong++;
  }

  const averageLevel = Math.round((sumLevel / total) * 10) / 10;
  const certifiedPercentage = Math.round((certified / total) * 100);

  return {
    totalSkills: total,
    certifiedCount: certified,
    selfAssessedCount: selfAssessed,
    pendingReviewCount: pendingReview,
    returnedCount: returned,
    averageLevel,
    strongCount: strong,
    certifiedPercentage,
  };
}

/**
 * Filter skills by category, verification status, and search query.
 */
export function filterSkills(
  skills: Skill[],
  filters: Pick<SkillFilterOptions, "category" | "verification" | "query">,
): Skill[] {
  const query = foldText(filters.query);

  return skills.filter((skill) => {
    if (filters.category !== "all" && skill.category !== filters.category) {
      return false;
    }

    if (filters.verification !== "all" && skill.verification !== filters.verification) {
      return false;
    }

    if (query) {
      const haystack = foldText(
        `${skill.name} ${skill.code} ${skill.description} ${skill.certifiedProof?.certificateName ?? ""} ${skill.certifiedProof?.certificateCode ?? ""}`,
      );
      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Sorts skills based on sort option.
 */
export function sortSkills(skills: Skill[], sortBy: SkillSortOption): Skill[] {
  const copy = [...skills];

  switch (sortBy) {
    case "level-desc":
      return copy.sort((a, b) => b.currentLevel - a.currentLevel || a.name.localeCompare(b.name));
    case "level-asc":
      return copy.sort((a, b) => a.currentLevel - b.currentLevel || a.name.localeCompare(b.name));
    case "name-asc":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "recent":
      return copy.sort((a, b) => b.lastEvaluatedAt.localeCompare(a.lastEvaluatedAt));
    default:
      return copy;
  }
}

/**
 * Compute counts per category for the filter tabs.
 */
export function getCategoryCounts(skills: Skill[]): Record<string, number> {
  const counts: Record<string, number> = { all: skills.length };
  for (const s of skills) {
    counts[s.category] = (counts[s.category] || 0) + 1;
  }
  return counts;
}
