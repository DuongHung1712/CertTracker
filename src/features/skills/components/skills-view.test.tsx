// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill, SkillsWorkspaceData } from "../types";
import { SkillsView } from "./skills-view";

const quickRateSkill = vi.fn();
const saveSkillAssessment = vi.fn();
const batchSaveSkillAssessments = vi.fn();
const removeMemberSkill = vi.fn();
const reviewMemberSkill = vi.fn();

vi.mock("@/features/skills/actions", () => ({
  quickRateSkill: (...args: unknown[]) => quickRateSkill(...args),
  saveSkillAssessment: (...args: unknown[]) => saveSkillAssessment(...args),
  batchSaveSkillAssessments: (...args: unknown[]) => batchSaveSkillAssessments(...args),
  removeMemberSkill: (...args: unknown[]) => removeMemberSkill(...args),
  reviewMemberSkill: (...args: unknown[]) => reviewMemberSkill(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const SKILL_AWS: Skill = {
  id: "5eed0000-0000-0000-0000-00000000a201",
  code: "SKL-CLD-01",
  name: "Cloud Architecture & AWS Services",
  category: "cloud",
  description: "Designing AWS VPCs, IAM boundaries, and serverless workloads.",
  currentLevel: 4,
  verification: "certified",
  certifiedProof: {
    certificateName: "AWS Certified Solutions Architect - Associate",
    certificateCode: "",
    issuer: "Amazon Web Services",
    verifiedDate: "2026-06-15",
    expiryDate: "2029-06-15",
    credentialUrl: "/api/records/5eed0000-0000-0000-0000-00000000c001/evidence",
  },
  yearsOfExperience: 4,
  lastEvaluatedAt: "2026-10-15",
  evidenceNote: "Production EKS migration",
  isSaved: true,
};

const SKILL_TS: Skill = {
  id: "5eed0000-0000-0000-0000-00000000a205",
  code: "SKL-FED-02",
  name: "TypeScript & Type-Level Design",
  category: "frontend",
  description: "Strict type systems and schema validation.",
  currentLevel: 3,
  verification: "self_assessed",
  yearsOfExperience: 3,
  lastEvaluatedAt: "2026-10-18",
  isSaved: true,
};

const SKILL_K8S: Skill = {
  id: "5eed0000-0000-0000-0000-00000000a202",
  code: "SKL-CLD-02",
  name: "Kubernetes & Container Orchestration",
  category: "cloud",
  description: "Managing workloads and pod disruption budgets.",
  currentLevel: 5,
  verification: "pending_review",
  yearsOfExperience: 5,
  lastEvaluatedAt: "2026-11-15",
  evidenceNote: "Multi-region cluster architecture RFC",
  isSaved: true,
};

const SKILL_PYTHON_UNSAVED: Skill = {
  id: "5eed0000-0000-0000-0000-00000000a217",
  code: "SKL-BED-05",
  name: "Python (FastAPI & AsyncIO)",
  category: "backend",
  description: "Async Python services and Pydantic validation.",
  currentLevel: 0,
  verification: "self_assessed",
  yearsOfExperience: 0,
  lastEvaluatedAt: "",
  isSaved: false,
};

function makeWorkspace(overrides: Partial<Extract<SkillsWorkspaceData, { status: "ok" }>> = {}): Extract<SkillsWorkspaceData, { status: "ok" }> {
  const catalogSkills = overrides.catalogSkills ?? [SKILL_AWS, SKILL_TS, SKILL_K8S, SKILL_PYTHON_UNSAVED];
  const profileSkills = overrides.profileSkills ?? catalogSkills.filter((s) => s.isSaved);
  return {
    status: "ok",
    targetMember: {
      id: "5eed0000-0000-0000-0000-00000000b003",
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
    profileSkills,
    catalogSkills,
    canEdit: true,
    canReview: false,
    isOwnProfile: true,
    pendingReviews: [],
    ...overrides,
  };
}

describe("SkillsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quickRateSkill.mockResolvedValue({ ok: true, data: { id: "ms-1", verificationStatus: "self_assessed" } });
    saveSkillAssessment.mockResolvedValue({ ok: true, data: { id: "ms-1", verificationStatus: "self_assessed" } });
    batchSaveSkillAssessments.mockResolvedValue({ ok: true, data: { count: 1 } });
    removeMemberSkill.mockResolvedValue({ ok: true, data: null });
    reviewMemberSkill.mockResolvedValue({ ok: true, data: null });
  });

  afterEach(cleanup);

  it("renders role summary, four KPIs, and saved skills while keeping unsaved catalogue skills off the main grid", () => {
    render(<SkillsView workspace={makeWorkspace()} />);

    expect(screen.getByRole("heading", { name: /Senior Software Engineer/ })).toBeDefined();
    expect(screen.getByText("Average level")).toBeDefined();
    expect(screen.getByText("Level 4 or higher")).toBeDefined();
    expect(screen.getByText("Waiting for review", { selector: "dt" })).toBeDefined();
    expect(screen.getByText("Certified", { selector: "dt" })).toBeDefined();

    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();
    expect(screen.queryByText("Python (FastAPI & AsyncIO)")).toBeNull();
  });

  it("renders empty profile state with Update skill rate CTA when member has zero saved skills", () => {
    render(
      <SkillsView
        workspace={makeWorkspace({
          profileSkills: [],
          catalogSkills: [SKILL_PYTHON_UNSAVED],
        })}
      />,
    );

    expect(screen.getByText("No skills rated yet")).toBeDefined();
    expect(screen.getByRole("button", { name: "Update skill rate" })).toBeDefined();
    expect(screen.queryByText("No skills match these filters")).toBeNull();
  });

  it("filters by category tab, searches, clears filters, and starts in table view and switches to cards", async () => {
    const user = userEvent.setup();
    render(<SkillsView workspace={makeWorkspace()} />);

    await user.click(screen.getByRole("tab", { name: /Cloud & Infrastructure/i }));
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.queryByText("TypeScript & Type-Level Design")).toBeNull();

    await user.click(screen.getByRole("tab", { name: /All skills/i }));
    await user.type(screen.getByRole("searchbox", { name: "Search skills or certificates" }), "nothing-like-this");
    expect(screen.getByText("No skills match these filters")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();

    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /Your level/ })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Card view" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("opens detail dialog with View certificate link and omits empty certificateCode", async () => {
    const user = userEvent.setup();
    render(<SkillsView workspace={makeWorkspace()} />);

    await user.click(screen.getByRole("button", { name: "Cloud Architecture & AWS Services" }));
    expect(screen.getByRole("link", { name: /View certificate/ })).toBeDefined();
    expect(screen.queryByText(/Check credential/i)).toBeNull();
    expect(screen.getByText("Amazon Web Services · issued 15/06/2026 · valid until 15/06/2029")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Edit rating" }));
    expect(screen.getByRole("heading", { name: "Rate Cloud Architecture & AWS Services" })).toBeDefined();
  });

  it("optimistically updates quick-rate and rolls back with duration Infinity toast on server error", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    quickRateSkill.mockResolvedValueOnce({ ok: false, error: "Could not save rating." });

    render(<SkillsView workspace={makeWorkspace()} />);

    await user.click(screen.getByRole("button", { name: "Card view" }));
    const tsCard = screen.getByText("TypeScript & Type-Level Design").closest("article")!;
    await user.click(within(tsCard).getByRole("radio", { name: /^Level 4/ }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not save rating.", { duration: Infinity });
    });
    // Rolled back only TS to level 3
    expect(within(tsCard).getByRole("radio", { name: /^Level 3/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("rolls back only the failing skill when another skill was updated concurrently", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    let rejectFirst!: (val: { ok: false; error: string }) => void;
    quickRateSkill
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            rejectFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ ok: true, data: { id: "ms-aws", verificationStatus: "certified" } });

    render(<SkillsView workspace={makeWorkspace()} />);

    await user.click(screen.getByRole("button", { name: "Card view" }));
    const tsCard = screen.getByRole("button", { name: "TypeScript & Type-Level Design" }).closest("article")!;
    const awsCard = screen.getByRole("button", { name: "Cloud Architecture & AWS Services" }).closest("article")!;

    await user.click(within(tsCard).getByRole("radio", { name: /^Level 4/ }));
    await user.click(within(awsCard).getByRole("radio", { name: /^Level 3/ }));

    rejectFirst({ ok: false, error: "Could not save TS." });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Could not save TS.", { duration: Infinity });
    });
    expect(within(tsCard).getByRole("radio", { name: /^Level 3/ }).getAttribute("aria-checked")).toBe("true");
    expect(within(awsCard).getByRole("radio", { name: /^Level 3/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("submits Level 5 assessment without preview copy, keeps dialog open on error, and removes saved skills", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    saveSkillAssessment.mockResolvedValueOnce({ ok: false, error: "Save failed." });

    render(<SkillsView workspace={makeWorkspace()} />);

    await user.click(screen.getByRole("button", { name: "Edit TypeScript & Type-Level Design" }));
    await user.click(screen.getByRole("radio", { name: /^5 · Master/ }));
    expect(screen.getByText(/Level 5 needs your manager/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Send for review" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Save failed.", { duration: Infinity }));
    expect(screen.getByRole("heading", { name: "Rate TypeScript & Type-Level Design" })).toBeDefined();

    saveSkillAssessment.mockResolvedValueOnce({ ok: true, data: { id: "ms-ts", verificationStatus: "pending_review" } });
    await user.click(screen.getByRole("button", { name: "Send for review" }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenLastCalledWith("TypeScript & Type-Level Design set to level 5, waiting for manager review"),
    );
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("Preview only"));

    // Remove skill via confirmation dialog
    await user.click(screen.getByRole("button", { name: "Edit TypeScript & Type-Level Design" }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("alertdialog")).toBeDefined();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(removeMemberSkill).toHaveBeenCalledWith({ skillId: SKILL_TS.id }));
    await waitFor(() => expect(screen.queryByText("TypeScript & Type-Level Design")).toBeNull());
  });

  it("batch-saves a partial subset of skills from Update skill rate", async () => {
    const user = userEvent.setup();
    render(
      <SkillsView
        workspace={makeWorkspace({
          profileSkills: [],
          catalogSkills: [SKILL_PYTHON_UNSAVED],
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Update skill rate" }));
    await user.click(screen.getByRole("radio", { name: /^Level 3/ }));
    await user.click(screen.getByRole("button", { name: "Save ratings" }));

    await waitFor(() =>
      expect(batchSaveSkillAssessments).toHaveBeenCalledWith({
        items: [{ skillId: SKILL_PYTHON_UNSAVED.id, level: 3 }],
      }),
    );
    await waitFor(() => expect(screen.getByText("Python (FastAPI & AsyncIO)")).toBeDefined());
  });

  it("lets a manager approve and return Level 5 skills and shows returned note", async () => {
    const user = userEvent.setup();
    const skillGo: Skill = {
      ...SKILL_K8S,
      id: "5eed0000-0000-0000-0000-00000000a206",
      code: "SKL-BED-01",
      name: "Go Microservices",
      category: "backend",
    };

    render(
      <SkillsView
        workspace={makeWorkspace({
          canEdit: false,
          canReview: true,
          isOwnProfile: false,
          catalogSkills: [SKILL_K8S, skillGo, SKILL_TS],
        })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Update skill rate" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Edit / })).toBeNull();

    // Approve Go Microservices at Level 5
    await user.click(screen.getByRole("button", { name: "Card view" }));
    const goCard = screen.getByRole("button", { name: "Go Microservices" }).closest("article")!;
    await user.click(within(goCard).getByRole("button", { name: /^Approve/ }));
    await waitFor(() =>
      expect(reviewMemberSkill).toHaveBeenCalledWith({
        memberId: "5eed0000-0000-0000-0000-00000000b003",
        skillId: skillGo.id,
        decision: "approve",
        note: undefined,
      }),
    );
    await waitFor(() => expect(within(goCard).getByText("Certified")).toBeDefined());

    // Return Kubernetes with required note validation
    const k8sCard = screen.getByRole("button", { name: "Kubernetes & Container Orchestration" }).closest("article")!;
    await user.click(within(k8sCard).getByRole("button", { name: /^Return/ }));
    const alertDialog = screen.getByRole("alertdialog");
    await user.click(within(alertDialog).getByRole("button", { name: "Return" }));
    expect(within(alertDialog).getByText("Write what the member should fix.")).toBeDefined();

    await user.type(within(alertDialog).getByLabelText(/What should the member fix/), "Add disaster recovery plan");
    await user.click(within(alertDialog).getByRole("button", { name: "Return" }));

    await waitFor(() =>
      expect(reviewMemberSkill).toHaveBeenCalledWith({
        memberId: "5eed0000-0000-0000-0000-00000000b003",
        skillId: SKILL_K8S.id,
        decision: "return",
        note: "Add disaster recovery plan",
      }),
    );
    await waitFor(() => expect(screen.getByText("Returned: Add disaster recovery plan")).toBeDefined());
  });

  it("renders pending review queue on manager own overview and approves inline", async () => {
    const user = userEvent.setup();
    render(
      <SkillsView
        workspace={makeWorkspace({
          pendingReviews: [
            {
              id: "rev-1",
              memberId: "5eed0000-0000-0000-0000-00000000b003",
              memberCode: "M003",
              memberName: "Le Minh Chau",
              teamName: "Team Cloud",
              skillId: SKILL_K8S.id,
              skillCode: SKILL_K8S.code,
              skillName: SKILL_K8S.name,
              category: "cloud",
              evidenceNote: "Multi-region RFC",
              yearsOfExperience: 5,
              lastEvaluatedAt: "2026-11-15",
            },
          ],
        })}
      />,
    );

    const queue = screen.getByRole("region", { name: "Waiting for your review" });
    expect(within(queue).getByRole("link", { name: "Le Minh Chau" }).getAttribute("href")).toBe(
      "/skills?memberId=5eed0000-0000-0000-0000-00000000b003",
    );

    await user.click(within(queue).getByRole("button", { name: /Approve/ }));
    await waitFor(() =>
      expect(reviewMemberSkill).toHaveBeenCalledWith({
        memberId: "5eed0000-0000-0000-0000-00000000b003",
        skillId: SKILL_K8S.id,
        decision: "approve",
        note: undefined,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", { name: "Waiting for your review" })).toBeNull());
  });
});
