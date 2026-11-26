// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DcDialog } from "@/features/organizations/components/dc-dialog";
import { ProgramDialog } from "@/features/organizations/components/program-dialog";
import { TeamDialog } from "@/features/organizations/components/team-dialog";

vi.mock("@/features/organizations/actions", () => ({
  createDc: vi.fn(),
  updateDc: vi.fn(),
  createProgram: vi.fn(),
  updateProgram: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

const cases = [
  ["DcDialog", <DcDialog key="d" open onOpenChange={vi.fn()} editing={null} />, /centre name/i],
  ["ProgramDialog", <ProgramDialog key="p" open onOpenChange={vi.fn()} editing={null} dcs={[]} />, /name/i],
  ["TeamDialog", <TeamDialog key="t" open onOpenChange={vi.fn()} editing={null} programs={[]} />, /name/i],
] as const;

describe("organization dialogs ask before discarding typed input", () => {
  it.each(cases)("%s", async (_n, ui, label) => {
    const user = userEvent.setup();
    render(ui);
    await user.type(screen.getAllByLabelText(label)[0], "Typed");
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Discard your changes?")).toBeTruthy();
  });
});
