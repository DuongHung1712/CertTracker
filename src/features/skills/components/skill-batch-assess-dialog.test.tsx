// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTERPRISE_SKILL_CATALOG } from "../seed-data";
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
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Rate many skills" })).toBeDefined();
    expect(screen.getByText(/^\d+ of \d+ rated$/)).toBeDefined();
    // Default category is Backend & Systems, contains Distributed Systems
    expect(screen.getByText("Distributed Systems & Resilient Messaging")).toBeDefined();
  });

  it("switches domain tabs and displays corresponding skills", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    // Click "Frontend & Web" tab
    const frontendTab = screen.getByRole("tab", { name: /Frontend & Web/i });
    await user.click(frontendTab);

    expect(screen.getByText("Modern Frontend (Next.js & React)")).toBeDefined();
    // Backend skill should no longer be in the active tab view
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });

  it("updates skill level in batch dialog and saves on Save ratings", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={handleSaveBatch}
      />,
    );

    // Rate the first displayed skill (e.g. Distributed Systems) to level 4
    const level4Radios = screen.getAllByRole("radio", { name: /Level 4/i });
    await user.click(level4Radios[0]);

    // Click Apply Assessments button
    const applyBtn = screen.getByRole("button", { name: "Save ratings" });
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
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={handleSaveBatch}
      />,
    );

    const setL1Btn = screen.getByRole("button", { name: "Set all to 1" });
    await user.click(setL1Btn);

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("set to level 1"));
  });

  it("filters skills when typing in search input", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search all skills" });
    await user.type(searchInput, "FastAPI");

    expect(screen.getByText("Python (FastAPI & AsyncIO)")).toBeDefined();
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });

  it("shows clean empty state message when search matches nothing", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search all skills" });
    await user.type(searchInput, "NonExistentSkillXYZ");

    expect(screen.getByText(/No skills match/i)).toBeDefined();
  });

  it("clears the area via Set all to 0", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    const clearBtn = screen.getByRole("button", { name: "Set all to 0" });
    await user.click(clearBtn);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("set to level 0"));
  });
});
