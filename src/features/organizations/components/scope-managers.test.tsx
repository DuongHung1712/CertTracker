// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { setScopeManagers } from "@/features/organizations/actions";
import { ProgramSection } from "@/features/organizations/components/program-section";
import { TeamSection } from "@/features/organizations/components/team-section";

vi.mock("@/features/organizations/actions", () => ({
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  deleteProgram: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  deleteTeam: vi.fn(),
  setScopeManagers: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CANDIDATES = [
  { userId: "u1", fullName: "Nguyễn Văn An", email: "an@company.test" },
  { userId: "u2", fullName: "Lê Minh Châu", email: "chau@company.test" },
  { userId: "u3", fullName: "Phạm Thu Dung", email: "dung@company.test" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Unified Set managers flow for Programs and Teams", () => {
  it("shows Managers column and lets admin search (diacritic-insensitive), select, remove, and save for a Program", async () => {
    vi.mocked(setScopeManagers).mockResolvedValue({ ok: true, data: null });
    render(
      <ProgramSection
        programs={[{ id: "p1", name: "Cloud Program", dcId: "d1", dcName: "DC North", managerIds: ["u1"] }]}
        dcs={[{ id: "d1", name: "DC North" }]}
        candidates={CANDIDATES}
        canManage
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Managers" })).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn An")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Set managers" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("1 selected")).toBeTruthy();

    // Search without diacritics matches "Lê Minh Châu"
    await userEvent.type(within(dialog).getByRole("searchbox"), "chau");
    expect(within(dialog).queryByText("Phạm Thu Dung")).toBeNull();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Lê Minh Châu/ }));
    expect(within(dialog).getByText("2 selected")).toBeTruthy();

    // Remove via selected chip
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove Nguyễn Văn An" }));
    expect(within(dialog).getByText("1 selected")).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("button", { name: "Save managers" }));
    expect(setScopeManagers).toHaveBeenCalledWith({
      scope: { kind: "program", id: "p1" },
      userIds: ["u2"],
    });
    expect(toast.success).toHaveBeenCalledWith("Saved managers for Cloud Program");
  });

  it("shows inherited program managers and uses the same Set managers dialog for a Team", async () => {
    vi.mocked(setScopeManagers).mockResolvedValue({ ok: true, data: null });
    render(
      <TeamSection
        teams={[{ id: "t1", name: "Team Cloud", programId: "p1", programName: "Cloud Program", managerIds: ["u2"] }]}
        programs={[{ id: "p1", name: "Cloud Program", managerIds: ["u1"] }]}
        candidates={CANDIDATES}
        canManage
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Managers" })).toBeTruthy();
    expect(screen.getByText("Lê Minh Châu")).toBeTruthy();
    expect(screen.getByText("Nguyễn Văn An (program)")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Set managers" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Also managed via/)).toBeTruthy();
    expect(within(dialog).getByText("Via program")).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("button", { name: "Clear all" }));
    expect(within(dialog).getByText("None selected")).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("button", { name: "Save managers" }));
    expect(setScopeManagers).toHaveBeenCalledWith({
      scope: { kind: "team", id: "t1" },
      userIds: [],
    });
    expect(toast.success).toHaveBeenCalledWith("Saved managers for Team Cloud");
  });
});
