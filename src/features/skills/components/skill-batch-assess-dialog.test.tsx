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

const BACKEND_SKILLS = ENTERPRISE_SKILL_CATALOG.filter((s) => s.category === "backend");
const ALL_RATED = BACKEND_SKILLS.slice(0, 3).map((s) => ({ ...s, currentLevel: 2 as const }));

describe("SkillBatchAssessDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders the dialog with header, progress counter, Reset button, and backend skills by default", () => {
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ENTERPRISE_SKILL_CATALOG}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Update skill rate" })).toBeDefined();
    expect(screen.getByText(/^\d+ of \d+ rated$/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Reset" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Set all to 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Set all to 0" })).toBeNull();
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

    const frontendTab = screen.getByRole("tab", { name: /Frontend & Web/i });
    await user.click(frontendTab);

    expect(screen.getByText("Modern Frontend (Next.js & React)")).toBeDefined();
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });

  it("updates skill level and saves when all skills are rated", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={ALL_RATED}
        onSave={handleSaveBatch}
      />,
    );

    const level4Radios = screen.getAllByRole("radio", { name: /Level 4/i });
    await user.click(level4Radios[0]);

    await user.click(screen.getByRole("button", { name: "Save ratings" }));

    expect(handleSaveBatch).toHaveBeenCalled();
    expect(handleSaveBatch.mock.calls[0][0][0].currentLevel).toBe(4);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks Save ratings when any skill is unrated, highlights missing rows in red, and focuses the first missing row", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    const skills = [
      { ...BACKEND_SKILLS[0], currentLevel: 3 as const },
      { ...BACKEND_SKILLS[1], currentLevel: 0 as const },
    ];

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={skills}
        onSave={handleSaveBatch}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save ratings" }));

    expect(handleSaveBatch).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("Rate all missing skills before saving (1 left).");
    expect(screen.getByText("Required")).toBeDefined();
    expect(scrollIntoView).toHaveBeenCalled();

    // Rating the missing skill clears its red highlight and lets Save succeed
    const missingRow = document.querySelector('tr[data-missing="true"]');
    expect(missingRow).not.toBeNull();
    const level2 = missingRow!.querySelector<HTMLElement>('[role="radio"][aria-label*="Level 2"]');
    await user.click(level2!);
    expect(document.querySelector('tr[data-missing="true"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Save ratings" }));
    expect(handleSaveBatch).toHaveBeenCalled();
  });

  it("resets unsaved changes back to initial ratings via Reset button", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={ALL_RATED}
        onSave={vi.fn()}
      />,
    );

    const resetBtn = screen.getByRole("button", { name: "Reset" }) as HTMLButtonElement;
    expect(resetBtn.disabled).toBe(true);

    await user.click(screen.getAllByRole("radio", { name: /Level 5/i })[0]);
    expect(resetBtn.disabled).toBe(false);

    await user.click(resetBtn);
    expect(resetBtn.disabled).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Ratings reset");
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
});
