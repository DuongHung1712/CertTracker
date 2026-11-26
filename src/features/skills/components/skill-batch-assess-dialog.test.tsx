// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKILL_FIXTURES } from "../__fixtures__/skills";
import { SkillBatchAssessDialog } from "./skill-batch-assess-dialog";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const BACKEND_SKILLS = SKILL_FIXTURES.filter((s) => s.category === "backend");
const RATED_FIRST_TWO = BACKEND_SKILLS.slice(0, 4).map((s, idx) => ({
  ...s,
  currentLevel: (idx < 2 ? 2 : 0) as 0 | 2,
  isSaved: idx < 2,
}));

describe("SkillBatchAssessDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders header, counter, disabled Save/Reset when clean, and backend skills by default", () => {
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SKILL_FIXTURES}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Update skill rate" })).toBeDefined();
    expect(screen.getByText(/^\d+ of \d+ rated$/)).toBeDefined();
    expect((screen.getByRole("button", { name: "Reset" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Save ratings" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Distributed Systems & Resilient Messaging")).toBeDefined();
  });

  it("switches domain tabs and displays corresponding skills", async () => {
    const user = userEvent.setup();
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SKILL_FIXTURES}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("tab", { name: /Frontend & Web/i }));
    expect(screen.getByText("Modern Frontend (Next.js & React)")).toBeDefined();
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();
  });

  it("saves only changed skills even when other skills remain at 0, and supports rating down to 0", async () => {
    const user = userEvent.setup();
    const handleSaveBatch = vi.fn().mockResolvedValue(true);
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={RATED_FIRST_TWO}
        onSave={handleSaveBatch}
      />,
    );

    // Change skill 0 from level 2 -> level 0, and skill 2 from level 0 -> level 4 (skill 3 stays 0)
    await user.click(screen.getAllByRole("radio", { name: /Level 0/i })[0]);
    await user.click(screen.getAllByRole("radio", { name: /Level 4/i })[2]);

    const saveBtn = screen.getByRole("button", { name: "Save ratings" }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
    expect(screen.getByText("2 skills changed. Save to update your profile.")).toBeDefined();

    await user.click(saveBtn);

    await waitFor(() => expect(handleSaveBatch).toHaveBeenCalledTimes(1));
    const saved = handleSaveBatch.mock.calls[0][0];
    expect(saved).toHaveLength(2);
    expect(saved.map((s: { id: string; currentLevel: number }) => [s.id, s.currentLevel])).toEqual([
      [RATED_FIRST_TWO[0].id, 0],
      [RATED_FIRST_TWO[2].id, 4],
    ]);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows Saving… while pending and keeps dialog open if onSave returns false", async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: boolean) => void;
    const handleSaveBatch = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve;
        }),
    );
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={RATED_FIRST_TWO}
        onSave={handleSaveBatch}
      />,
    );

    await user.click(screen.getAllByRole("radio", { name: /Level 3/i })[0]);
    await user.click(screen.getByRole("button", { name: "Save ratings" }));

    expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true);
    resolveSave(false);

    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Save ratings" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(handleOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("resets unsaved changes back to initial ratings via Reset button", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={RATED_FIRST_TWO}
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

  it("asks to discard changes when closing while dirty", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();

    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={handleOpenChange}
        skills={RATED_FIRST_TWO}
        onSave={vi.fn()}
      />,
    );

    await user.click(screen.getAllByRole("radio", { name: /Level 3/i })[0]);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("alertdialog")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a saved Level 0 skill as rated, not 'Not rated'", () => {
    const savedAtZero = [{ ...BACKEND_SKILLS[0], currentLevel: 0 as const, verification: "self_assessed" as const, isSaved: true }];
    render(<SkillBatchAssessDialog open={true} onOpenChange={vi.fn()} skills={savedAtZero} onSave={vi.fn()} />);

    expect(screen.getByText("1 of 1 rated")).toBeDefined();
    expect(screen.queryByText("Not rated")).toBeNull();
  });

  it("filters skills when typing in search input and shows clean empty state", () => {
    render(
      <SkillBatchAssessDialog
        open={true}
        onOpenChange={vi.fn()}
        skills={SKILL_FIXTURES}
        onSave={vi.fn()}
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: "Search all skills" });
    fireEvent.change(searchInput, { target: { value: "FastAPI" } });
    expect(screen.getByText("Python (FastAPI & AsyncIO)")).toBeDefined();
    expect(screen.queryByText("Distributed Systems & Resilient Messaging")).toBeNull();

    fireEvent.change(searchInput, { target: { value: "NonExistentSkillXYZ" } });
    expect(screen.getByText(/No skills match/i)).toBeDefined();
  }, 15_000);
});
