import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSkillReview, SkillsWorkspaceData } from "@/features/skills/types";

const getCurrentUser = vi.fn();
const loadSkillsWorkspace = vi.fn<(...args: unknown[]) => Promise<SkillsWorkspaceData>>();
const listPendingSkillReviews = vi.fn<(...args: unknown[]) => Promise<PendingSkillReview[]>>();

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/features/auth/queries", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/features/skills/queries", () => ({
  loadSkillsWorkspace: (...args: unknown[]) => loadSkillsWorkspace(...args),
  listPendingSkillReviews: (...args: unknown[]) => listPendingSkillReviews(...args),
}));

vi.mock("@/features/skills/components/skills-realtime", () => ({
  SkillsRealtime: () => null,
}));

vi.mock("@/features/skills/actions", () => ({
  quickRateSkill: vi.fn(),
  saveSkillAssessment: vi.fn(),
  batchSaveSkillAssessments: vi.fn(),
  removeMemberSkill: vi.fn(),
  reviewMemberSkill: vi.fn(),
}));

const { default: SkillsPage } = await import("./page");

const MEMBER_ID = "5eed0000-0000-0000-0000-00000000b003";
const OTHER_ID = "5eed0000-0000-0000-0000-00000000b001";

const WORKSPACE_OK: Extract<SkillsWorkspaceData, { status: "ok" }> = {
  status: "ok",
  targetMember: {
    id: MEMBER_ID,
    code: "M003",
    fullName: "Le Minh Chau",
    teamName: "Team Cloud",
  },
  benchmark: {
    roleName: "Senior Software Engineer",
    teamName: "Team Cloud",
    experienceLevel: "4 years of experience",
    description: "4 years of experience. Rate skills from 0 to 5 and keep certificates linked for verified status.",
  },
  profileSkills: [],
  catalogSkills: [],
  canEdit: true,
  canReview: false,
  isOwnProfile: true,
  pendingReviews: [],
};

describe("SkillsPage server component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated user to /login", async () => {
    getCurrentUser.mockResolvedValueOnce(null);

    await expect(SkillsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/login");
  });

  it("redirects a member requesting another memberId back to /skills", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-member",
      email: "member@example.com",
      role: "member",
      memberId: MEMBER_ID,
    });

    await expect(
      SkillsPage({ searchParams: Promise.resolve({ memberId: OTHER_ID }) }),
    ).rejects.toThrow("redirect:/skills");
  });

  it("renders unlinked empty state for a member without memberId", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-1",
      email: "member@example.com",
      role: "member",
      memberId: null,
    });

    const jsx = await SkillsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("My skills");
    expect(html).toContain("Your account is not linked to a member");
  });

  it("renders pending review queue and Members guidance for an unlinked admin without memberId", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-admin",
      email: "admin@example.com",
      role: "admin",
      memberId: null,
    });
    listPendingSkillReviews.mockResolvedValueOnce([
      {
        id: "rev-1",
        memberId: MEMBER_ID,
        memberCode: "M003",
        memberName: "Le Minh Chau",
        teamName: "Team Cloud",
        skillId: "5eed0000-0000-0000-0000-00000000a213",
        skillCode: "SKL-BED-04",
        skillName: "System Architecture & Scalability Patterns",
        category: "backend",
        evidenceNote: "Async worker RFC",
        yearsOfExperience: 4,
        lastEvaluatedAt: "2026-11-15",
      },
    ]);

    const jsx = await SkillsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(jsx);

    expect(listPendingSkillReviews).toHaveBeenCalledWith(null);
    expect(html).toContain("Waiting for your review (1)");
    expect(html).toContain("System Architecture &amp; Scalability Patterns");
    expect(html).toContain("Choose a member in Members to view their skills");
    expect(html).toContain('href="/members"');
  });

  it("renders page header and workspace for linked member", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-2",
      email: "member@example.com",
      role: "member",
      memberId: MEMBER_ID,
    });
    loadSkillsWorkspace.mockResolvedValueOnce(WORKSPACE_OK);

    const jsx = await SkillsPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(jsx);

    expect(loadSkillsWorkspace).toHaveBeenCalledWith({
      viewer: { role: "member", memberId: MEMBER_ID },
      targetMemberId: null,
    });
    expect(html).toContain("My skills");
    expect(html).toContain("Senior Software Engineer");
    expect(html).toContain("No skills rated yet");
  });

  it("renders member profile header for manager viewing ?memberId=...", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-mgr",
      email: "manager@example.com",
      role: "manager",
      memberId: "5eed0000-0000-0000-0000-00000000b004",
    });
    loadSkillsWorkspace.mockResolvedValueOnce({
      ...WORKSPACE_OK,
      canEdit: false,
      canReview: true,
      isOwnProfile: false,
    });

    const jsx = await SkillsPage({ searchParams: Promise.resolve({ memberId: MEMBER_ID }) });
    const html = renderToStaticMarkup(jsx);

    expect(loadSkillsWorkspace).toHaveBeenCalledWith({
      viewer: { role: "manager", memberId: "5eed0000-0000-0000-0000-00000000b004" },
      targetMemberId: MEMBER_ID,
    });
    expect(html).toContain("Skills · Le Minh Chau");
    expect(html).toContain("Back to Members");
  });

  it("renders Member not found when workspace returns not_found", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-mgr",
      email: "manager@example.com",
      role: "manager",
      memberId: "5eed0000-0000-0000-0000-00000000b004",
    });
    loadSkillsWorkspace.mockResolvedValueOnce({ status: "not_found" });

    const jsx = await SkillsPage({ searchParams: Promise.resolve({ memberId: OTHER_ID }) });
    const html = renderToStaticMarkup(jsx);

    expect(html).toContain("Member not found");
    expect(html).toContain("Back to Members");
  });

  it("treats empty ?memberId= query parameter as absent", async () => {
    getCurrentUser.mockResolvedValueOnce({
      id: "u-2",
      email: "member@example.com",
      role: "member",
      memberId: MEMBER_ID,
    });
    loadSkillsWorkspace.mockResolvedValueOnce(WORKSPACE_OK);

    const jsx = await SkillsPage({ searchParams: Promise.resolve({ memberId: "  " }) });
    const html = renderToStaticMarkup(jsx);

    expect(loadSkillsWorkspace).toHaveBeenCalledWith({
      viewer: { role: "member", memberId: MEMBER_ID },
      targetMemberId: null,
    });
    expect(html).toContain("My skills");
  });
});
