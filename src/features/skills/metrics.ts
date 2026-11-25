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

/**
 * Applies a new level. Level 5 always needs manager review; otherwise a linked
 * certificate keeps the skill certified and anything else is self-assessed.
 */
export function rateSkill(skill: Skill, level: SkillLevel, today: string = todayVn()): Skill {
  const verification: VerificationStatus =
    level === 5 ? "pending_review" : skill.certifiedProof ? "certified" : "self_assessed";
  return { ...skill, currentLevel: level, verification, lastEvaluatedAt: today };
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
      averageLevel: 0,
      strongCount: 0,
      certifiedPercentage: 0,
    };
  }

  let certified = 0;
  let selfAssessed = 0;
  let pendingReview = 0;
  let sumLevel = 0;
  let strong = 0;

  for (const s of skills) {
    sumLevel += s.currentLevel;
    if (s.verification === "certified") certified++;
    else if (s.verification === "self_assessed") selfAssessed++;
    else if (s.verification === "pending_review") pendingReview++;

    if (s.currentLevel >= 4) strong++;
  }

  const averageLevel = Math.round((sumLevel / total) * 10) / 10;
  const certifiedPercentage = Math.round((certified / total) * 100);

  return {
    totalSkills: total,
    certifiedCount: certified,
    selfAssessedCount: selfAssessed,
    pendingReviewCount: pendingReview,
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
    // 1. Category filter
    if (filters.category !== "all" && skill.category !== filters.category) {
      return false;
    }

    // 2. Verification filter
    if (filters.verification === "certified" && skill.verification !== "certified") {
      return false;
    }
    if (filters.verification === "self_assessed" && skill.verification !== "self_assessed") {
      return false;
    }
    if (filters.verification === "pending_review" && skill.verification !== "pending_review") {
      return false;
    }

    // 3. Search query
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
