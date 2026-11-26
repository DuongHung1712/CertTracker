import { describe, expect, it } from "vitest";
import {
  calculateSkillStats,
  filterSkills,
  getCategoryCounts,
  rateSkill,
  resolveSkillVerification,
  sortSkills,
  toVerificationStatus,
} from "./metrics";
import {
  batchSaveSkillAssessmentsSchema,
  quickRateSkillSchema,
  removeMemberSkillSchema,
  reviewMemberSkillSchema,
  updateSkillAssessmentSchema,
} from "./schema";
import { SKILL_FIXTURES as SKILLS } from "./__fixtures__/skills";
import type { Skill } from "./types";

const SKILL_ID = "5eed0000-0000-0000-0000-00000000a201";
const SKILL_ID_2 = "5eed0000-0000-0000-0000-00000000a202";
const MEMBER_ID = "5eed0000-0000-0000-0000-00000000b003";

describe("Skill metrics and calculations", () => {
  it("calculates stats on the fixture skills", () => {
    const stats = calculateSkillStats(SKILLS);

    expect(stats.totalSkills).toBe(6);
    expect(stats.certifiedCount).toBe(3);
    expect(stats.selfAssessedCount).toBe(2);
    expect(stats.pendingReviewCount).toBe(1);
    expect(stats.returnedCount).toBe(0);
    expect(stats.certifiedPercentage).toBe(50);
    expect(stats.averageLevel).toBe(3);
    expect(stats.strongCount).toBe(2);
  });

  it("counts returned skills separately in stats", () => {
    const returnedSkill: Skill = {
      ...SKILLS[0],
      currentLevel: 4,
      verification: "returned",
      reviewNote: "Add architecture details",
    };
    const stats = calculateSkillStats([returnedSkill, SKILLS[1]]);
    expect(stats.returnedCount).toBe(1);
    expect(stats.certifiedCount).toBe(1);
    expect(stats.totalSkills).toBe(2);
  });

  it("handles empty skill list gracefully without divide-by-zero", () => {
    const stats = calculateSkillStats([]);

    expect(stats.totalSkills).toBe(0);
    expect(stats.certifiedCount).toBe(0);
    expect(stats.returnedCount).toBe(0);
    expect(stats.averageLevel).toBe(0);
    expect(stats.certifiedPercentage).toBe(0);
    expect(stats.strongCount).toBe(0);
  });

  it("filters skills by category accurately", () => {
    const cloudSkills = filterSkills(SKILLS, {
      category: "cloud",
      verification: "all",
      query: "",
    });

    expect(cloudSkills.length).toBeGreaterThan(0);
    expect(cloudSkills.every((s) => s.category === "cloud")).toBe(true);
  });

  it("filters skills by verification status including returned", () => {
    const returnedSkill: Skill = {
      ...SKILLS[0],
      verification: "returned",
      reviewNote: "Clarify scope",
    };
    const list = [returnedSkill, ...SKILLS.slice(1)];

    const certified = filterSkills(list, {
      category: "all",
      verification: "certified",
      query: "",
    });
    expect(certified.every((s) => s.verification === "certified")).toBe(true);

    const returned = filterSkills(list, {
      category: "all",
      verification: "returned",
      query: "",
    });
    expect(returned).toHaveLength(1);
    expect(returned[0].id).toBe(returnedSkill.id);
  });

  it("filters skills by text search across name, code, description, and certificate", () => {
    const results = filterSkills(SKILLS, {
      category: "all",
      verification: "all",
      query: "kubernetes",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((s) => s.name.includes("Kubernetes"))).toBe(true);
  });

  it("sorts skills by level and name", () => {
    const sortedDesc = sortSkills(SKILLS, "level-desc");
    expect(sortedDesc[0].currentLevel).toBeGreaterThanOrEqual(sortedDesc[sortedDesc.length - 1].currentLevel);

    const sortedAsc = sortSkills(SKILLS, "level-asc");
    expect(sortedAsc[0].currentLevel).toBeLessThanOrEqual(sortedAsc[sortedAsc.length - 1].currentLevel);

    const sortedName = sortSkills(SKILLS, "name-asc");
    expect(sortedName[0].name.localeCompare(sortedName[1].name)).toBeLessThanOrEqual(0);
  });

  it("tallies category counts correctly", () => {
    const counts = getCategoryCounts(SKILLS);
    expect(counts.all).toBe(SKILLS.length);
    expect(counts.cloud).toBeGreaterThan(0);
    expect(counts.backend).toBeGreaterThan(0);
  });
});

describe("resolveSkillVerification", () => {
  it("never trusts DB certified at levels 0-4 without valid proof", () => {
    expect(
      resolveSkillVerification({ currentLevel: 4, dbStatus: "certified", hasCertifiedProof: false }),
    ).toBe("self_assessed");
    expect(
      resolveSkillVerification({ currentLevel: 0, dbStatus: "certified", hasCertifiedProof: true }),
    ).toBe("self_assessed");
  });

  it("preserves Level 5 pending_review even with linked certificate proof", () => {
    expect(
      resolveSkillVerification({ currentLevel: 5, dbStatus: "pending_review", hasCertifiedProof: true }),
    ).toBe("pending_review");
  });

  it("normalizes stale pending_review rows below Level 5 cleanly", () => {
    expect(
      resolveSkillVerification({ currentLevel: 3, dbStatus: "pending_review", hasCertifiedProof: false }),
    ).toBe("self_assessed");
    expect(
      resolveSkillVerification({ currentLevel: 3, dbStatus: "pending_review", hasCertifiedProof: true }),
    ).toBe("certified");
  });

  it("preserves Level 5 manager-endorsed certified and returned states", () => {
    expect(
      resolveSkillVerification({ currentLevel: 5, dbStatus: "certified", hasCertifiedProof: false }),
    ).toBe("certified");
    expect(
      resolveSkillVerification({ currentLevel: 4, dbStatus: "returned", hasCertifiedProof: true }),
    ).toBe("returned");
  });
});

describe("Skill schemas validation", () => {
  it("validates valid assessment input with GUID skillId and 0.5 YoE", () => {
    const valid = {
      skillId: SKILL_ID,
      newLevel: 4,
      evidenceNote: "  Production lead on major platform launch  ",
      yearsOfExperience: 2.5,
    };

    const res = updateSkillAssessmentSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.evidenceNote).toBe("Production lead on major platform launch");
      expect(res.data.yearsOfExperience).toBe(2.5);
    }
  });

  it("validates assessment input with newLevel or currentLevel", () => {
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, newLevel: 3, yearsOfExperience: 3 }).success,
    ).toBe(true);
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, currentLevel: 2, yearsOfExperience: 1 }).success,
    ).toBe(true);
  });

  it("rejects non-GUID skillId across all schemas", () => {
    expect(updateSkillAssessmentSchema.safeParse({ skillId: "skl-01", newLevel: 3, yearsOfExperience: 2 }).success).toBe(false);
    expect(quickRateSkillSchema.safeParse({ skillId: "skl-01", level: 3 }).success).toBe(false);
    expect(removeMemberSkillSchema.safeParse({ skillId: "skl-01" }).success).toBe(false);
    expect(
      reviewMemberSkillSchema.safeParse({ memberId: "bad-id", skillId: SKILL_ID, decision: "approve" }).success,
    ).toBe(false);
    expect(
      batchSaveSkillAssessmentsSchema.safeParse({ items: [{ skillId: "skl-01", level: 2 }] }).success,
    ).toBe(false);
  });

  it("rejects assessment input when no level is provided or level/YoE is out of range", () => {
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, yearsOfExperience: 2 }).success,
    ).toBe(false);
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, newLevel: 6, yearsOfExperience: 2 }).success,
    ).toBe(false);
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, newLevel: -1, yearsOfExperience: 2 }).success,
    ).toBe(false);
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, newLevel: 3, yearsOfExperience: 50.5 }).success,
    ).toBe(false);
    expect(
      updateSkillAssessmentSchema.safeParse({ skillId: SKILL_ID, newLevel: 3, yearsOfExperience: -0.5 }).success,
    ).toBe(false);
  });

  it("validates batchSaveSkillAssessmentsSchema and rejects empty or duplicate skillIds", () => {
    expect(batchSaveSkillAssessmentsSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      batchSaveSkillAssessmentsSchema.safeParse({
        items: [
          { skillId: SKILL_ID, level: 3 },
          { skillId: SKILL_ID, level: 4 },
        ],
      }).success,
    ).toBe(false);
    expect(
      batchSaveSkillAssessmentsSchema.safeParse({
        items: [
          { skillId: SKILL_ID, level: 0 },
          { skillId: SKILL_ID_2, level: 5 },
        ],
      }).success,
    ).toBe(true);
  });

  it("requires non-empty note when reviewMemberSkillSchema decision is return", () => {
    expect(
      reviewMemberSkillSchema.safeParse({ memberId: MEMBER_ID, skillId: SKILL_ID, decision: "approve" }).success,
    ).toBe(true);
    expect(
      reviewMemberSkillSchema.safeParse({ memberId: MEMBER_ID, skillId: SKILL_ID, decision: "return", note: "   " }).success,
    ).toBe(false);
    const validReturn = reviewMemberSkillSchema.safeParse({
      memberId: MEMBER_ID,
      skillId: SKILL_ID,
      decision: "return",
      note: "  Add architecture RFC link  ",
    });
    expect(validReturn.success).toBe(true);
    if (validReturn.success) {
      expect(validReturn.data.note).toBe("Add architecture RFC link");
    }
  });
});

describe("rateSkill", () => {
  const base: Skill = { ...SKILLS[0], certifiedProof: undefined, verification: "self_assessed" };

  it("sends level 5 to manager review", () => {
    expect(rateSkill(base, 5, "2026-11-19").verification).toBe("pending_review");
  });

  it("keeps a skill with a certificate certified for levels 1-4, but not level 0", () => {
    const certified = SKILLS.find((s) => s.certifiedProof)!;
    expect(rateSkill(certified, 2, "2026-11-19").verification).toBe("certified");
    expect(rateSkill(certified, 0, "2026-11-19").verification).toBe("self_assessed");
  });

  it("preserves endorsed Level 5 when rating stays at 5, and clears reviewNote when re-rating", () => {
    const endorsed: Skill = {
      ...base,
      currentLevel: 5,
      verification: "certified",
      reviewedByName: "Tran Manager",
      reviewedAt: "2026-11-10T00:00:00Z",
    };
    expect(rateSkill(endorsed, 5, "2026-11-19").verification).toBe("certified");

    const returned: Skill = {
      ...base,
      currentLevel: 4,
      verification: "returned",
      reviewNote: "Add RFC link",
    };
    const rerated = rateSkill(returned, 5, "2026-11-19");
    expect(rerated.verification).toBe("pending_review");
    expect(rerated.reviewNote).toBeUndefined();
  });

  it("marks other ratings self-assessed and stamps the date", () => {
    const rated = rateSkill(base, 3, "2026-11-19");
    expect(rated).toMatchObject({ currentLevel: 3, verification: "self_assessed", lastEvaluatedAt: "2026-11-19" });
  });
});

describe("toVerificationStatus", () => {
  it("keeps known statuses and reads unknown or missing values as self-rated", () => {
    expect(toVerificationStatus("returned")).toBe("returned");
    expect(toVerificationStatus("certified")).toBe("certified");
    expect(toVerificationStatus("bogus")).toBe("self_assessed");
    expect(toVerificationStatus(null)).toBe("self_assessed");
  });
});
