import { beforeEach, describe, expect, it, vi } from "vitest";

const MEMBER_ID = "5eed0000-0000-0000-0000-00000000b001";
const OTHER_MEMBER_ID = "5eed0000-0000-0000-0000-00000000b003";
const MANAGER_MEMBER_ID = "5eed0000-0000-0000-0000-00000000b099";
const DOMAIN_CLOUD_ID = "5eed0000-0000-0000-0000-00000000d001";
const DOMAIN_BACKEND_ID = "5eed0000-0000-0000-0000-00000000d002";
const SKILL_CLOUD_ID = "5eed0000-0000-0000-0000-00000000a201";
const SKILL_BACKEND_ID = "5eed0000-0000-0000-0000-00000000a213";
const CERT_AWS_ID = "5eed0000-0000-0000-0000-00000000e001";
const CERT_AWS_PRO_ID = "5eed0000-0000-0000-0000-00000000e009";
const RECORD_AWS_ID = "5eed0000-0000-0000-0000-00000000c001";
const RECORD_AWS_PRO_ID = "5eed0000-0000-0000-0000-00000000c002";

type MockTableState = {
  memberRow: Record<string, unknown> | null;
  careerProfileRow: Record<string, unknown> | null;
  skillDomains: Record<string, unknown>[];
  skills: Record<string, unknown>[];
  memberSkills: Record<string, unknown>[];
  pendingReviewRows: Record<string, unknown>[];
  trainingRecords: Record<string, unknown>[];
  skillCertLinks: Record<string, unknown>[];
};

const state: MockTableState = {
  memberRow: null,
  careerProfileRow: null,
  skillDomains: [],
  skills: [],
  memberSkills: [],
  pendingReviewRows: [],
  trainingRecords: [],
  skillCertLinks: [],
};

const recordedCalls: {
  table: string;
  eqs: [string, unknown][];
  neqs: [string, unknown][];
  ins: [string, unknown[]][];
}[] = [];

function createChain(table: string) {
  const callLog = {
    table,
    eqs: [] as [string, unknown][],
    neqs: [] as [string, unknown][],
    ins: [] as [string, unknown[]][],
  };
  recordedCalls.push(callLog);

  let selected = "";

  const resolveRows = () => {
    switch (table) {
      case "members":
        return { data: state.memberRow, error: null };
      case "v_member_profiles":
        return { data: state.careerProfileRow, error: null };
      case "skill_domains":
        return { data: state.skillDomains, error: null };
      case "skills":
        return { data: state.skills, error: null };
      case "member_skills": {
        const isPendingQueue = callLog.eqs.some(
          ([col, val]) => col === "verification_status" && val === "pending_review",
        );
        let rows = isPendingQueue ? [...state.pendingReviewRows] : [...state.memberSkills];
        for (const [col, val] of callLog.neqs) {
          rows = rows.filter((row) => row[col] !== val);
        }
        for (const [col, val] of callLog.eqs) {
          if (col === "member_id") rows = rows.filter((row) => row.member_id === val);
          if (col === "verification_status") rows = rows.filter((row) => row.verification_status === val);
          if (col === "current_level") rows = rows.filter((row) => row.current_level === val);
        }
        return { data: rows, error: null };
      }
      case "v_training_records": {
        let rows = [...state.trainingRecords];
        for (const [col, val] of callLog.eqs) {
          rows = rows.filter((row) => row[col] === val);
        }
        for (const [col, vals] of callLog.ins) {
          rows = rows.filter((row) => vals.includes(row[col]));
        }
        return { data: rows, error: null };
      }
      case "skill_certificate_links": {
        let rows = [...state.skillCertLinks];
        for (const [col, vals] of callLog.ins) {
          rows = rows.filter((row) => vals.includes(row[col]));
        }
        return { data: rows, error: null };
      }
      default:
        return { data: [], error: null };
    }
  };

  const chain: Record<string, unknown> = {
    select: (cols: string) => {
      selected = cols;
      return chain;
    },
    eq: (col: string, val: unknown) => {
      callLog.eqs.push([col, val]);
      return chain;
    },
    neq: (col: string, val: unknown) => {
      callLog.neqs.push([col, val]);
      return chain;
    },
    in: (col: string, vals: unknown[]) => {
      callLog.ins.push([col, vals]);
      return chain;
    },
    order: () => chain,
    range: async () => resolveRows(),
    maybeSingle: async () => resolveRows(),
    then: (onFulfilled: (val: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
      void selected;
      return Promise.resolve(resolveRows()).then(onFulfilled, onRejected);
    },
  };

  return chain;
}

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => createChain(table),
  }),
}));

const {
  listPendingSkillReviewCounts,
  listPendingSkillReviews,
  loadMemberSkillSummary,
  loadSkillsWorkspace,
} = await import("@/features/skills/queries");

function seedBaseCatalogue() {
  state.skillDomains = [
    { id: DOMAIN_CLOUD_ID, name: "Cloud & Infrastructure", slug: "cloud", sort_order: 1 },
    { id: DOMAIN_BACKEND_ID, name: "Backend & Systems", slug: "backend", sort_order: 2 },
  ];
  state.skills = [
    {
      id: SKILL_CLOUD_ID,
      code: "SKL-CLD-01",
      name: "Cloud Architecture & AWS Services",
      domain_id: DOMAIN_CLOUD_ID,
      description: "Designing AWS VPCs and serverless architectures.",
      sort_order: 1,
    },
    {
      id: SKILL_BACKEND_ID,
      code: "SKL-BED-04",
      name: "System Architecture & Scalability Patterns",
      domain_id: DOMAIN_BACKEND_ID,
      description: "Event-driven backbones and caching.",
      sort_order: 2,
    },
  ];
}

beforeEach(() => {
  recordedCalls.length = 0;
  state.memberRow = {
    id: MEMBER_ID,
    code: "M001",
    full_name: "Nguyen Van An",
    teams: { name: "Team Cloud" },
  };
  state.careerProfileRow = {
    career_role_name: "Senior Software Engineer",
    yoe_years: 4.5,
  };
  seedBaseCatalogue();
  state.memberSkills = [];
  state.pendingReviewRows = [];
  state.trainingRecords = [];
  state.skillCertLinks = [];
});

describe("loadSkillsWorkspace", () => {
  it("returns not_found when members returns null (unknown or out-of-scope memberId)", async () => {
    state.memberRow = null;

    const result = await loadSkillsWorkspace({
      viewer: { role: "manager", memberId: MANAGER_MEMBER_ID },
      targetMemberId: OTHER_MEMBER_ID,
    });

    expect(result).toEqual({ status: "not_found" });
  });

  it("returns not_found for invalid non-GUID targetMemberId without querying DB", async () => {
    const result = await loadSkillsWorkspace({
      viewer: { role: "admin", memberId: null },
      targetMemberId: "not-a-uuid",
    });

    expect(result).toEqual({ status: "not_found" });
    expect(recordedCalls).toHaveLength(0);
  });

  it("returns empty profileSkills and full catalogSkills for a freshly created member with zero member_skills", async () => {
    const result = await loadSkillsWorkspace({
      viewer: { role: "member", memberId: MEMBER_ID },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    expect(result.profileSkills).toEqual([]);
    expect(result.catalogSkills).toHaveLength(2);
    expect(result.catalogSkills.every((s) => s.currentLevel === 0 && s.isSaved === false)).toBe(true);
    expect(result.targetMember).toEqual({
      id: MEMBER_ID,
      code: "M001",
      fullName: "Nguyen Van An",
      teamName: "Team Cloud",
    });
    expect(result.benchmark.roleName).toBe("Senior Software Engineer");
    expect(result.benchmark.teamName).toBe("Team Cloud");
    expect(result.benchmark.experienceLevel).toBe("4.5 years of experience");
    expect(result.canEdit).toBe(true);
    expect(result.canReview).toBe(false);
    expect(result.isOwnProfile).toBe(true);
  });

  it("derives certifiedProof only from approved non-renewed non-expired training records joined with skill_certificate_links", async () => {
    state.memberSkills = [
      {
        id: "ms-1",
        member_id: MEMBER_ID,
        skill_id: SKILL_CLOUD_ID,
        current_level: 4,
        years_of_experience: 4,
        verification_status: "self_assessed",
        evidence_note: "Production AWS workloads",
        last_evaluated_at: "2026-10-15",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        reviewer: null,
      },
    ];
    state.skillCertLinks = [
      {
        skill_id: SKILL_CLOUD_ID,
        certificate_id: CERT_AWS_ID,
        proves_level: 3,
        certificates: { level: "Associate" },
      },
      {
        skill_id: SKILL_CLOUD_ID,
        certificate_id: CERT_AWS_PRO_ID,
        proves_level: 4,
        certificates: { level: null },
      },
    ];
    state.trainingRecords = [
      {
        id: RECORD_AWS_ID,
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        certificate_name: "AWS Solutions Architect Associate",
        provider_name: "AWS",
        issued_date: "2025-11-14",
        expiry_date: "2028-11-14",
        expiry_status: "Active",
        evidence_path: null,
        certificate_url: "https://aws.amazon.com/saa",
        status: "done",
        approval: "approved",
        renewed: false,
      },
      // Higher proves_level (4) with uploaded evidence file
      {
        id: RECORD_AWS_PRO_ID,
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_PRO_ID,
        certificate_name: "AWS Solutions Architect Professional",
        provider_name: "AWS",
        issued_date: "2026-01-20",
        expiry_date: "2029-01-20",
        expiry_status: "Active",
        evidence_path: "members/m1/pro.pdf",
        certificate_url: null,
        status: "done",
        approval: "approved",
        renewed: false,
      },
    ];

    const result = await loadSkillsWorkspace({
      viewer: { role: "member", memberId: MEMBER_ID },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const recordCall = recordedCalls.find((c) => c.table === "v_training_records");
    expect(recordCall?.eqs).toEqual(
      expect.arrayContaining([
        ["member_id", MEMBER_ID],
        ["status", "done"],
        ["approval", "approved"],
        ["renewed", false],
      ]),
    );
    expect(recordCall?.ins).toEqual([
      ["expiry_status", ["Active", "Expiring in 60d", "Expiring Soon", "No Expiry"]],
    ]);

    const cloud = result.profileSkills.find((s) => s.id === SKILL_CLOUD_ID);
    expect(cloud?.verification).toBe("certified");
    expect(cloud?.certifiedProof).toEqual({
      certificateName: "AWS Solutions Architect Professional",
      certificateCode: "",
      issuer: "AWS",
      verifiedDate: "2026-01-20",
      expiryDate: "2029-01-20",
      credentialUrl: `/api/records/${RECORD_AWS_PRO_ID}/evidence`,
      recordId: RECORD_AWS_PRO_ID,
    });
  });

  it("excludes expired, waiting, returned, and renewed training records from certifiedProof", async () => {
    state.memberSkills = [
      {
        id: "ms-1",
        member_id: MEMBER_ID,
        skill_id: SKILL_CLOUD_ID,
        current_level: 3,
        years_of_experience: 2.5,
        verification_status: "certified",
        evidence_note: null,
        last_evaluated_at: "2026-10-15",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        reviewer: null,
      },
    ];
    state.skillCertLinks = [
      {
        skill_id: SKILL_CLOUD_ID,
        certificate_id: CERT_AWS_ID,
        proves_level: 3,
        certificates: { level: "Associate" },
      },
    ];
    state.trainingRecords = [
      {
        id: "rec-expired",
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        certificate_name: "Expired Cert",
        provider_name: "AWS",
        issued_date: "2022-01-01",
        expiry_date: "2025-01-01",
        expiry_status: "Expired",
        evidence_path: null,
        certificate_url: null,
        status: "done",
        approval: "approved",
        renewed: false,
      },
      {
        id: "rec-waiting",
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        certificate_name: "Waiting Cert",
        provider_name: "AWS",
        issued_date: "2026-10-01",
        expiry_date: null,
        expiry_status: "No Expiry",
        evidence_path: null,
        certificate_url: null,
        status: "done",
        approval: "waiting",
        renewed: false,
      },
      {
        id: "rec-renewed",
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        certificate_name: "Renewed Cert",
        provider_name: "AWS",
        issued_date: "2024-01-01",
        expiry_date: "2027-01-01",
        expiry_status: "Active",
        evidence_path: null,
        certificate_url: null,
        status: "done",
        approval: "approved",
        renewed: true,
      },
    ];

    const result = await loadSkillsWorkspace({
      viewer: { role: "member", memberId: MEMBER_ID },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const cloud = result.profileSkills[0];
    expect(cloud.certifiedProof).toBeUndefined();
    // Never trusts raw DB verification_status = "certified" for levels 0-4 without proof
    expect(cloud.verification).toBe("self_assessed");
  });

  it("preserves Level 5 pending_review with linked cert, honors endorsed Level 5, and normalizes stale rows", async () => {
    state.skillCertLinks = [
      {
        skill_id: SKILL_CLOUD_ID,
        certificate_id: CERT_AWS_ID,
        proves_level: 3,
        certificates: { level: "Associate" },
      },
    ];
    state.trainingRecords = [
      {
        id: RECORD_AWS_ID,
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        certificate_name: "AWS Solutions Architect Associate",
        provider_name: "AWS",
        issued_date: "2025-11-14",
        expiry_date: "2028-11-14",
        expiry_status: "Active",
        evidence_path: null,
        certificate_url: "https://aws.amazon.com/saa",
        status: "done",
        approval: "approved",
        renewed: false,
      },
    ];
    state.memberSkills = [
      {
        id: "ms-l5-pending",
        member_id: MEMBER_ID,
        skill_id: SKILL_CLOUD_ID,
        current_level: 5,
        years_of_experience: 5,
        verification_status: "pending_review",
        evidence_note: "Cloud lead",
        last_evaluated_at: "2026-11-10",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        reviewer: null,
      },
      {
        id: "ms-stale-pending",
        member_id: MEMBER_ID,
        skill_id: SKILL_BACKEND_ID,
        current_level: 3,
        years_of_experience: 3,
        verification_status: "pending_review",
        evidence_note: "Stale pre-migration row",
        last_evaluated_at: "2026-11-10",
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        reviewer: null,
      },
    ];

    const result = await loadSkillsWorkspace({
      viewer: { role: "member", memberId: MEMBER_ID },
    });

    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const cloud = result.profileSkills.find((s) => s.id === SKILL_CLOUD_ID);
    expect(cloud?.verification).toBe("pending_review");
    expect(cloud?.certifiedProof?.certificateName).toBe("AWS Solutions Architect Associate");

    const backend = result.profileSkills.find((s) => s.id === SKILL_BACKEND_ID);
    expect(backend?.verification).toBe("self_assessed");

    // Endorsed Level 5 (no cert required)
    state.memberSkills = [
      {
        id: "ms-l5-endorsed",
        member_id: MEMBER_ID,
        skill_id: SKILL_BACKEND_ID,
        current_level: 5,
        years_of_experience: 6,
        verification_status: "certified",
        evidence_note: "RFC approved",
        last_evaluated_at: "2026-11-15",
        reviewed_by: MANAGER_MEMBER_ID,
        reviewed_at: "2026-11-16T09:00:00Z",
        review_note: null,
        reviewer: { full_name: "Manager Tran" },
      },
    ];

    const endorsedResult = await loadSkillsWorkspace({
      viewer: { role: "manager", memberId: MANAGER_MEMBER_ID },
      targetMemberId: MEMBER_ID,
    });
    expect(endorsedResult.status).toBe("ok");
    if (endorsedResult.status !== "ok") return;
    expect(endorsedResult.canEdit).toBe(false);
    expect(endorsedResult.canReview).toBe(true);
    expect(endorsedResult.isOwnProfile).toBe(false);
    expect(endorsedResult.profileSkills[0]).toMatchObject({
      verification: "certified",
      reviewedByName: "Manager Tran",
      reviewedAt: "2026-11-16T09:00:00Z",
    });
  });
});

describe("listPendingSkillReviews & counts & summary", () => {
  it("excludes viewerMemberId from listPendingSkillReviews when caller is a manager", async () => {
    state.pendingReviewRows = [
      {
        id: "rev-self",
        member_id: MANAGER_MEMBER_ID,
        skill_id: SKILL_CLOUD_ID,
        current_level: 5,
        verification_status: "pending_review",
        years_of_experience: 5,
        evidence_note: "Own request",
        last_evaluated_at: "2026-11-15",
        member: { id: MANAGER_MEMBER_ID, code: "M099", full_name: "Manager Tran", teams: { name: "Team Cloud" } },
        skill: { id: SKILL_CLOUD_ID, code: "SKL-CLD-01", name: "Cloud Architecture & AWS Services", skill_domains: { slug: "cloud" } },
      },
      {
        id: "rev-other",
        member_id: OTHER_MEMBER_ID,
        skill_id: SKILL_BACKEND_ID,
        current_level: 5,
        verification_status: "pending_review",
        years_of_experience: 4,
        evidence_note: "Async worker RFC",
        last_evaluated_at: "2026-11-14",
        member: { id: OTHER_MEMBER_ID, code: "M003", full_name: "Le Minh Chau", teams: { name: "Team Cloud" } },
        skill: { id: SKILL_BACKEND_ID, code: "SKL-BED-04", name: "System Architecture & Scalability Patterns", skill_domains: { slug: "backend" } },
      },
    ];

    const reviews = await listPendingSkillReviews(MANAGER_MEMBER_ID);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toEqual({
      id: "rev-other",
      memberId: OTHER_MEMBER_ID,
      memberCode: "M003",
      memberName: "Le Minh Chau",
      teamName: "Team Cloud",
      skillId: SKILL_BACKEND_ID,
      skillCode: "SKL-BED-04",
      skillName: "System Architecture & Scalability Patterns",
      category: "backend",
      evidenceNote: "Async worker RFC",
      yearsOfExperience: 4,
      lastEvaluatedAt: "2026-11-14",
    });

    const counts = await listPendingSkillReviewCounts(MANAGER_MEMBER_ID);
    expect(counts.get(OTHER_MEMBER_ID)).toBe(1);
    expect(counts.has(MANAGER_MEMBER_ID)).toBe(false);
  });

  it("computes MemberSkillSummary using live proof derivation", async () => {
    state.memberSkills = [
      { skill_id: SKILL_CLOUD_ID, member_id: MEMBER_ID, current_level: 4, verification_status: "self_assessed" },
      { skill_id: SKILL_BACKEND_ID, member_id: MEMBER_ID, current_level: 5, verification_status: "pending_review" },
      { skill_id: "5eed0000-0000-0000-0000-00000000a202", member_id: MEMBER_ID, current_level: 3, verification_status: "returned" },
    ];
    state.trainingRecords = [
      {
        id: RECORD_AWS_ID,
        member_id: MEMBER_ID,
        certificate_id: CERT_AWS_ID,
        status: "done",
        approval: "approved",
        renewed: false,
        expiry_status: "Active",
      },
    ];
    state.skillCertLinks = [
      { skill_id: SKILL_CLOUD_ID, certificate_id: CERT_AWS_ID, proves_level: 3, certificates: { level: "Associate" } },
    ];

    const summary = await loadMemberSkillSummary(MEMBER_ID);
    expect(summary).toEqual({
      totalSkills: 3,
      certifiedCount: 1,
      pendingReviewCount: 1,
      returnedCount: 1,
      averageLevel: 4,
    });
  });
});
