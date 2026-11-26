import { beforeEach, describe, expect, it, vi } from "vitest";

const MEMBER_ID = "5eed0000-0000-0000-0000-00000000b003";
const OTHER_MEMBER_ID = "5eed0000-0000-0000-0000-00000000b001";
const SKILL_ID = "5eed0000-0000-0000-0000-00000000a201";
const SKILL_ID_2 = "5eed0000-0000-0000-0000-00000000a202";
const ROW_ID = "5eed0000-0000-0000-0000-000000001111";

const revalidatePath = vi.fn();
const getCurrentUser = vi.fn();

type DbError = { code?: string | null; message: string } | null;

let existingSingleRow: Record<string, unknown> | null = null;
let existingListRows: Record<string, unknown>[] = [];
let readError: DbError = null;
let writeError: DbError = null;
let affectedRows: Record<string, unknown>[] = [{ id: ROW_ID, verification_status: "self_assessed" }];

const insertCalls: unknown[] = [];
const updateCalls: { values: unknown; eqs: [string, unknown][] }[] = [];
const upsertCalls: { rows: unknown; options: unknown }[] = [];
const deleteCalls: { eqs: [string, unknown][] }[] = [];
const fromMock = vi.fn();

function makeSupabaseClient() {
  return {
    from: (table: string) => {
      fromMock(table);
      return {
        select: () => {
          const eqs: [string, unknown][] = [];
          const chain: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              eqs.push([col, val]);
              return chain;
            },
            order: () => chain,
            range: async () => ({
              data: readError ? null : existingListRows,
              error: readError,
            }),
            maybeSingle: async () => ({
              data: readError ? null : existingSingleRow,
              error: readError,
            }),
          };
          return chain;
        },
        insert: (values: unknown) => {
          insertCalls.push(values);
          return {
            select: () => ({
              single: async () => ({
                data: writeError ? null : (affectedRows[0] ?? null),
                error: writeError,
              }),
            }),
          };
        },
        update: (values: unknown) => {
          const entry = { values, eqs: [] as [string, unknown][] };
          updateCalls.push(entry);
          const chain: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              entry.eqs.push([col, val]);
              return chain;
            },
            select: async () => ({
              data: writeError ? null : affectedRows,
              error: writeError,
            }),
          };
          return chain;
        },
        upsert: (rows: unknown, options: unknown) => {
          upsertCalls.push({ rows, options });
          return {
            select: () => {
              const promise = Promise.resolve({
                data: writeError ? null : affectedRows,
                error: writeError,
              });
              return Object.assign(promise, {
                single: async () => ({
                  data: writeError ? null : (affectedRows[0] ?? null),
                  error: writeError,
                }),
              });
            },
          };
        },
        delete: () => {
          const entry = { eqs: [] as [string, unknown][] };
          deleteCalls.push(entry);
          const chain: Record<string, unknown> = {
            eq: (col: string, val: unknown) => {
              entry.eqs.push([col, val]);
              return chain;
            },
            select: async () => ({
              data: writeError ? null : affectedRows,
              error: writeError,
            }),
          };
          return chain;
        },
      };
    },
  };
}

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentUser: () => getCurrentUser(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeSupabaseClient(),
}));

const {
  batchSaveSkillAssessments,
  quickRateSkill,
  removeMemberSkill,
  reviewMemberSkill,
  saveSkillAssessment,
} = await import("@/features/skills/actions");

beforeEach(() => {
  vi.clearAllMocks();
  insertCalls.length = 0;
  updateCalls.length = 0;
  upsertCalls.length = 0;
  deleteCalls.length = 0;
  existingSingleRow = null;
  existingListRows = [];
  readError = null;
  writeError = null;
  affectedRows = [{ id: ROW_ID, verification_status: "self_assessed" }];
  getCurrentUser.mockResolvedValue({
    id: "5eed0000-0000-0000-0000-00000000f00c",
    email: "member@certtracker.test",
    role: "member",
    memberId: MEMBER_ID,
  });
});

describe("auth and input validation guards", () => {
  it("rejects unlinked user (memberId: null) without calling Supabase writes", async () => {
    getCurrentUser.mockResolvedValue({
      id: "5eed0000-0000-0000-0000-00000000f00a",
      email: "admin@certtracker.test",
      role: "admin",
      memberId: null,
    });

    expect(await quickRateSkill({ skillId: SKILL_ID, level: 3 })).toEqual({
      ok: false,
      error: "Your account is not linked to a member yet.",
    });
    expect(
      await saveSkillAssessment({ skillId: SKILL_ID, newLevel: 3, yearsOfExperience: 2 }),
    ).toEqual({
      ok: false,
      error: "Your account is not linked to a member yet.",
    });
    expect(await batchSaveSkillAssessments({ items: [{ skillId: SKILL_ID, level: 3 }] })).toEqual({
      ok: false,
      error: "Your account is not linked to a member yet.",
    });
    expect(await removeMemberSkill({ skillId: SKILL_ID })).toEqual({
      ok: false,
      error: "Your account is not linked to a member yet.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects invalid GUID, out-of-range level/YoE, and return without note without touching DB", async () => {
    expect((await quickRateSkill({ skillId: "skl-01", level: 3 })).ok).toBe(false);
    expect((await quickRateSkill({ skillId: SKILL_ID, level: 6 })).ok).toBe(false);
    expect((await quickRateSkill({ skillId: SKILL_ID, level: -1 })).ok).toBe(false);
    expect(
      (await saveSkillAssessment({ skillId: SKILL_ID, newLevel: 3, yearsOfExperience: 51 })).ok,
    ).toBe(false);
    expect(
      (await reviewMemberSkill({ memberId: OTHER_MEMBER_ID, skillId: SKILL_ID, decision: "return", note: "  " })).ok,
    ).toBe(false);
    expect((await batchSaveSkillAssessments({ items: [] })).ok).toBe(false);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("quickRateSkill", () => {
  it("inserts self_assessed for levels 0-4 (never certified) and revalidates pages", async () => {
    const result = await quickRateSkill({ skillId: SKILL_ID, level: 4 });

    expect(result).toEqual({ ok: true, data: { id: ROW_ID, verificationStatus: "self_assessed" } });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].rows).toMatchObject({
      member_id: MEMBER_ID,
      skill_id: SKILL_ID,
      current_level: 4,
      verification_status: "self_assessed",
      manager_endorsement_requested: false,
      years_of_experience: 0,
      evidence_note: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/skills");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/members");
  });

  it("sends pending_review for level 5 when not already endorsed", async () => {
    affectedRows = [{ id: ROW_ID, verification_status: "pending_review" }];
    const result = await quickRateSkill({ skillId: SKILL_ID, level: 5 });

    expect(result).toEqual({ ok: true, data: { id: ROW_ID, verificationStatus: "pending_review" } });
    expect(upsertCalls[0].rows).toMatchObject({
      current_level: 5,
      verification_status: "pending_review",
      manager_endorsement_requested: true,
    });
  });

  it("preserves certified when clicking 5 on an already-endorsed Level 5 without triggering BEFORE INSERT", async () => {
    existingSingleRow = {
      id: ROW_ID,
      current_level: 5,
      verification_status: "certified",
      years_of_experience: 4.5,
      evidence_note: "Approved RFC",
    };
    affectedRows = [{ id: ROW_ID, verification_status: "certified" }];

    const result = await quickRateSkill({ skillId: SKILL_ID, level: 5 });

    expect(result).toEqual({ ok: true, data: { id: ROW_ID, verificationStatus: "certified" } });
    expect(upsertCalls).toHaveLength(0);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].values).toMatchObject({
      current_level: 5,
      verification_status: "certified",
      manager_endorsement_requested: false,
    });
    expect(updateCalls[0].values).not.toHaveProperty("years_of_experience");
    expect(updateCalls[0].values).not.toHaveProperty("evidence_note");
  });

  it("maps 42501 and 23514 via mapPostgresError and enforces assertAffected on update", async () => {
    existingSingleRow = {
      id: ROW_ID,
      current_level: 3,
      verification_status: "self_assessed",
      years_of_experience: 2,
      evidence_note: null,
    };

    writeError = { code: "42501", message: "rls denied" };
    expect(await quickRateSkill({ skillId: SKILL_ID, level: 4 })).toEqual({
      ok: false,
      error: "You do not have permission to do this.",
    });

    writeError = { code: "23514", message: "check failed" };
    expect(await quickRateSkill({ skillId: SKILL_ID, level: 4 })).toEqual({
      ok: false,
      error: "Check the level, years of experience, and notes, then try again.",
    });

    writeError = null;
    affectedRows = [];
    expect(await quickRateSkill({ skillId: SKILL_ID, level: 4 })).toEqual({
      ok: false,
      error: "You do not have permission to do this, or the item no longer exists.",
    });
  });
});

describe("saveSkillAssessment", () => {
  it("passes null when evidenceNote is cleared and supports 0.5 years", async () => {
    const result = await saveSkillAssessment({
      skillId: SKILL_ID,
      newLevel: 3,
      yearsOfExperience: 0.5,
      evidenceNote: "   ",
    });

    expect(result.ok).toBe(true);
    expect(upsertCalls[0].rows).toMatchObject({
      current_level: 3,
      years_of_experience: 0.5,
      evidence_note: null,
      verification_status: "self_assessed",
      manager_endorsement_requested: false,
    });
  });

  it("preserves certified on already-endorsed Level 5 when updating notes/YoE at Level 5", async () => {
    existingSingleRow = {
      id: ROW_ID,
      current_level: 5,
      verification_status: "certified",
      years_of_experience: 4,
      evidence_note: "Old note",
    };
    affectedRows = [{ id: ROW_ID, verification_status: "certified" }];

    const result = await saveSkillAssessment({
      skillId: SKILL_ID,
      newLevel: 5,
      yearsOfExperience: 4.5,
      evidenceNote: "Updated architecture note",
    });

    expect(result).toEqual({ ok: true, data: { id: ROW_ID, verificationStatus: "certified" } });
    expect(updateCalls[0].values).toMatchObject({
      current_level: 5,
      years_of_experience: 4.5,
      evidence_note: "Updated architecture note",
      verification_status: "certified",
      manager_endorsement_requested: false,
    });
  });
});

describe("batchSaveSkillAssessments", () => {
  it("upserts changed items in one query while preserving existing YoE and evidenceNote", async () => {
    existingListRows = [
      {
        skill_id: SKILL_ID,
        current_level: 2,
        verification_status: "self_assessed",
        years_of_experience: 3.5,
        evidence_note: "Existing AWS project",
      },
    ];
    affectedRows = [{ id: ROW_ID }, { id: "row-2" }];

    const result = await batchSaveSkillAssessments({
      items: [
        { skillId: SKILL_ID, level: 4 },
        { skillId: SKILL_ID_2, level: 5 },
      ],
    });

    expect(result).toEqual({ ok: true, data: { count: 2 } });
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0]).toEqual({
      options: { onConflict: "member_id,skill_id" },
      rows: [
        expect.objectContaining({
          member_id: MEMBER_ID,
          skill_id: SKILL_ID,
          current_level: 4,
          years_of_experience: 3.5,
          evidence_note: "Existing AWS project",
          verification_status: "self_assessed",
          manager_endorsement_requested: false,
        }),
        expect.objectContaining({
          member_id: MEMBER_ID,
          skill_id: SKILL_ID_2,
          current_level: 5,
          years_of_experience: 0,
          evidence_note: null,
          verification_status: "pending_review",
          manager_endorsement_requested: true,
        }),
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/skills");
  });
});

describe("removeMemberSkill", () => {
  it("deletes own skill row and checks assertAffected", async () => {
    affectedRows = [{ id: ROW_ID }];
    expect(await removeMemberSkill({ skillId: SKILL_ID })).toEqual({ ok: true, data: null });
    expect(deleteCalls[0].eqs).toEqual([
      ["member_id", MEMBER_ID],
      ["skill_id", SKILL_ID],
    ]);

    affectedRows = [];
    expect(await removeMemberSkill({ skillId: SKILL_ID })).toEqual({
      ok: false,
      error: "You do not have permission to do this, or the item no longer exists.",
    });
  });
});

describe("reviewMemberSkill", () => {
  it("approves or returns a pending Level 5 request, including for unlinked Admin", async () => {
    getCurrentUser.mockResolvedValue({
      id: "5eed0000-0000-0000-0000-00000000f00a",
      email: "admin@certtracker.test",
      role: "admin",
      memberId: null,
    });
    affectedRows = [{ id: ROW_ID }];

    expect(
      await reviewMemberSkill({ memberId: OTHER_MEMBER_ID, skillId: SKILL_ID, decision: "approve" }),
    ).toEqual({ ok: true, data: null });
    expect(updateCalls[0].values).toEqual({ verification_status: "certified" });
    expect(updateCalls[0].eqs).toEqual([
      ["member_id", OTHER_MEMBER_ID],
      ["skill_id", SKILL_ID],
      ["current_level", 5],
      ["verification_status", "pending_review"],
    ]);

    expect(
      await reviewMemberSkill({
        memberId: OTHER_MEMBER_ID,
        skillId: SKILL_ID,
        decision: "return",
        note: "Add production architecture link",
      }),
    ).toEqual({ ok: true, data: null });
    expect(updateCalls[1].values).toEqual({
      current_level: 4,
      verification_status: "returned",
      review_note: "Add production architecture link",
    });
  });

  it("maps 42501 cleanly and returns clean error when zero rows updated", async () => {
    writeError = { code: "42501", message: "forbidden" };
    expect(
      await reviewMemberSkill({ memberId: OTHER_MEMBER_ID, skillId: SKILL_ID, decision: "approve" }),
    ).toEqual({
      ok: false,
      error: "Only a manager in scope or an admin can review this skill.",
    });

    writeError = null;
    affectedRows = [];
    expect(
      await reviewMemberSkill({ memberId: OTHER_MEMBER_ID, skillId: SKILL_ID, decision: "approve" }),
    ).toEqual({
      ok: false,
      error: "Only a pending Level 5 request can be approved or returned. Refresh and try again.",
    });
  });
});
