// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTERPRISE_SKILL_CATALOG, SEED_SKILLS } from "../seed-data";
import { SkillBatchAssessDialog } from "./skill-batch-assess-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SkillBatchAssessDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders the dialog with header, progress counter, and backend skills by default", () => {
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SEED_SKILLS}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={vi.fn()}
      />,
    );

    expect(screen.getByText("Quick Assess by Domain (Batch Fast-Fill)")).toBeDefined();
    expect(screen.getByText(/Rated/)).toBeDefined();
    // Default category is Backend & Systems, contains Distributed Systems
    expect(screen.getByText("Distributed Systems & Resilient Messaging")).toBeDefined();
  });

  it("switches domain tabs and displays corresponding skills", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SEED_SKILLS}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={vi.fn()}
      />,
    );

    // Click "Frontend & Web" tab
    const frontendTab = screen.getByRole("tab", { name: /Frontend & Web/i });
    await user.click(frontendTab);

    expect(screen.getByText("Modern Frontend (Next.js & React)")).toBeDefined();
    // Backend skill should no longer be in the active tab view
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });

  it("updates skill level in batch dialog and saves on Apply Assessments", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={SEED_SKILLS}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={handleSaveBatch}
      />,
    );

    // Rate the first displayed skill (e.g. Distributed Systems) to level 4
    const level4Radios = screen.getAllByRole("radio", { name: /Level 4/i });
    await user.click(level4Radios[0]);

    // Click Apply Assessments button
    const applyBtn = screen.getByRole("button", { name: /Apply Assessments/i });
    await user.click(applyBtn);

    expect(handleSaveBatch).toHaveBeenCalled();
    const savedSkills = handleSaveBatch.mock.calls[0][0];
    expect(savedSkills.length).toBeGreaterThan(0);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("fast-fills active domain with Level 1 via Domain Action", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn();
    const { toast } = await import("sonner");

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SEED_SKILLS}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={handleSaveBatch}
      />,
    );

    const setL1Btn = screen.getByRole("button", { name: /Set L1 \(Theory\)/i });
    await user.click(setL1Btn);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Set domain skills to Level 1"));
  });

  it("filters skills when typing in search input", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SEED_SKILLS}
        allCatalogSkills={ENTERPRISE_SKILL_CATALOG}
        onSaveBatch={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/Filter stack/i);
    await user.type(searchInput, "FastAPI");

    expect(screen.getByText("Python (FastAPI & AsyncIO)")).toBeDefined();
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });
});
