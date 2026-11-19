import type {
  Skill,
  SkillFilterOptions,
  SkillSortOption,
  SkillStats,
} from "./types";

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
      targetMetCount: 0,
      gapCount: 0,
      certifiedPercentage: 0,
    };
  }

  let certified = 0;
  let selfAssessed = 0;
  let pendingReview = 0;
  let sumLevel = 0;
  let targetMet = 0;
  let gaps = 0;

  for (const s of skills) {
    sumLevel += s.currentLevel;
    if (s.verification === "certified") certified++;
    else if (s.verification === "self_assessed") selfAssessed++;
    else if (s.verification === "pending_review") pendingReview++;

    if (s.currentLevel >= s.targetLevel) {
      targetMet++;
    } else {
      gaps++;
    }
  }

  const averageLevel = Math.round((sumLevel / total) * 10) / 10;
  const certifiedPercentage = Math.round((certified / total) * 100);

  return {
    totalSkills: total,
    certifiedCount: certified,
    selfAssessedCount: selfAssessed,
    pendingReviewCount: pendingReview,
    averageLevel,
    targetMetCount: targetMet,
    gapCount: gaps,
    certifiedPercentage,
  };
}

/**
 * Gap between target level and current level (0 if meeting or exceeding).
 */
export function getSkillGap(skill: Skill): number {
  return Math.max(0, skill.targetLevel - skill.currentLevel);
}

/**
 * Filter skills by category, verification status, and search query.
 */
export function filterSkills(
  skills: Skill[],
  filters: Pick<SkillFilterOptions, "category" | "verification" | "query">,
): Skill[] {
  const query = filters.query.trim().toLowerCase();

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
    if (filters.verification === "gaps_only" && skill.currentLevel >= skill.targetLevel) {
      return false;
    }

    // 3. Search query
    if (query) {
      const matchName = skill.name.toLowerCase().includes(query);
      const matchCode = skill.code.toLowerCase().includes(query);
      const matchDesc = skill.description.toLowerCase().includes(query);
      const matchCert =
        skill.certifiedProof?.certificateName.toLowerCase().includes(query) ||
        skill.certifiedProof?.certificateCode.toLowerCase().includes(query);

      if (!matchName && !matchCode && !matchDesc && !matchCert) {
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
    case "gap-desc":
      return copy.sort((a, b) => {
        const gapA = getSkillGap(a);
        const gapB = getSkillGap(b);
        return gapB - gapA || b.targetLevel - a.targetLevel || a.name.localeCompare(b.name);
      });
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
