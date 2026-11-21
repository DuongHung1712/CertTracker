import { describe, expect, it } from "vitest";
import { calculateSkillStats, filterSkills, getCategoryCounts, rateSkill, sortSkills } from "./metrics";
import { updateSkillAssessmentSchema } from "./schema";
import { SEED_SKILLS } from "./seed-data";
import type { Skill } from "./types";

describe("Skill metrics and calculations", () => {
  it("calculates accurate stats on realistic seed data", () => {
    const stats = calculateSkillStats(SEED_SKILLS);

    expect(stats.totalSkills).toBe(16);
    expect(stats.certifiedCount).toBe(8);
    expect(stats.selfAssessedCount).toBe(7);
    expect(stats.pendingReviewCount).toBe(1);
    expect(stats.certifiedPercentage).toBe(50);
    expect(stats.averageLevel).toBeGreaterThanOrEqual(2.5);
    expect(stats.averageLevel).toBeLessThanOrEqual(4.0);
    expect(stats.strongCount).toBe(SEED_SKILLS.filter((s) => s.currentLevel >= 4).length);
  });

  it("handles empty skill list gracefully without divide-by-zero", () => {
    const stats = calculateSkillStats([]);

    expect(stats.totalSkills).toBe(0);
    expect(stats.certifiedCount).toBe(0);
    expect(stats.averageLevel).toBe(0);
    expect(stats.certifiedPercentage).toBe(0);
    expect(stats.strongCount).toBe(0);
  });

  it("filters skills by category accurately", () => {
    const cloudSkills = filterSkills(SEED_SKILLS, {
      category: "cloud",
      verification: "all",
      query: "",
    });

    expect(cloudSkills.length).toBeGreaterThan(0);
    expect(cloudSkills.every((s) => s.category === "cloud")).toBe(true);
  });

  it("filters skills by verification status", () => {
    const certified = filterSkills(SEED_SKILLS, {
      category: "all",
      verification: "certified",
      query: "",
    });

    expect(certified.every((s) => s.verification === "certified")).toBe(true);

  });

  it("filters skills by text search across name, code, description, and certificate", () => {
    const results = filterSkills(SEED_SKILLS, {
      category: "all",
      verification: "all",
      query: "kubernetes",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((s) => s.name.includes("Kubernetes"))).toBe(true);
  });

  it("sorts skills by level and name", () => {
    const sortedDesc = sortSkills(SEED_SKILLS, "level-desc");
    expect(sortedDesc[0].currentLevel).toBeGreaterThanOrEqual(sortedDesc[sortedDesc.length - 1].currentLevel);

    const sortedAsc = sortSkills(SEED_SKILLS, "level-asc");
    expect(sortedAsc[0].currentLevel).toBeLessThanOrEqual(sortedAsc[sortedAsc.length - 1].currentLevel);

    const sortedName = sortSkills(SEED_SKILLS, "name-asc");
    expect(sortedName[0].name.localeCompare(sortedName[1].name)).toBeLessThanOrEqual(0);
  });

  it("tallies category counts correctly", () => {
    const counts = getCategoryCounts(SEED_SKILLS);
    expect(counts.all).toBe(SEED_SKILLS.length);
    expect(counts.cloud).toBeGreaterThan(0);
    expect(counts.backend).toBeGreaterThan(0);
  });
});

describe("Skill assessment schema validation", () => {
  it("validates valid assessment input with newLevel", () => {
    const valid = {
      skillId: "skl-01",
      newLevel: 4,
      evidenceNote: "Production lead on major platform launch",
      yearsOfExperience: 5,
      requestManagerReview: false,
    };

    const res = updateSkillAssessmentSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("validates valid assessment input with newLevel or currentLevel", () => {
    const validNew = {
      skillId: "skl-01",
      newLevel: 3,
      yearsOfExperience: 3,
    };
    expect(updateSkillAssessmentSchema.safeParse(validNew).success).toBe(true);

    const validCurrent = {
      skillId: "skl-01",
      currentLevel: 2,
      yearsOfExperience: 1,
    };
    expect(updateSkillAssessmentSchema.safeParse(validCurrent).success).toBe(true);
  });

  it("rejects assessment input when no level is provided", () => {
    const noLevel = {
      skillId: "skl-01",
      yearsOfExperience: 2,
    };
    const res = updateSkillAssessmentSchema.safeParse(noLevel);
    expect(res.success).toBe(false);
  });

  it("rejects level outside [0..5]", () => {
    const invalid = {
      skillId: "skl-01",
      newLevel: 6,
      yearsOfExperience: 2,
    };

    const res = updateSkillAssessmentSchema.safeParse(invalid);
    expect(res.success).toBe(false);

    const negative = {
      skillId: "skl-01",
      newLevel: -1,
      yearsOfExperience: 2,
    };
    expect(updateSkillAssessmentSchema.safeParse(negative).success).toBe(false);
  });
});

describe("rateSkill", () => {
  const base: Skill = { ...SEED_SKILLS[0], certifiedProof: undefined, verification: "self_assessed" };

  it("sends level 5 to manager review", () => {
    expect(rateSkill(base, 5, "2026-11-19").verification).toBe("pending_review");
  });

  it("keeps a skill with a certificate certified below level 5", () => {
    const certified = SEED_SKILLS.find((s) => s.certifiedProof)!;
    expect(rateSkill(certified, 2, "2026-11-19").verification).toBe("certified");
  });

  it("marks other ratings self-assessed and stamps the date", () => {
    const rated = rateSkill(base, 3, "2026-11-19");
    expect(rated).toMatchObject({ currentLevel: 3, verification: "self_assessed", lastEvaluatedAt: "2026-11-19" });
  });
});

