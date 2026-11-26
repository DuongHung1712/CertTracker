// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CareerRoleDialog } from "@/features/career/components/career-role-dialog";

vi.mock("@/features/career/actions", () => ({
  createCareerRole: vi.fn(),
  updateCareerRole: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

describe("CareerRoleDialog", () => {
  it("uses noValidate, * Required, RequiredMark, and resets validation errors on close", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<CareerRoleDialog open onOpenChange={onOpenChange} editing={null} />);

    const input = screen.getByLabelText(/^Role name/);
    expect(input.getAttribute("aria-required")).toBe("true");
    expect(screen.getByText("* Required")).toBeTruthy();
    expect(document.querySelector("form")?.hasAttribute("novalidate")).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a role name")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(<CareerRoleDialog open={false} onOpenChange={onOpenChange} editing={null} />);
    rerender(<CareerRoleDialog open onOpenChange={onOpenChange} editing={null} />);

    expect(screen.queryByText("Enter a role name")).toBeNull();
    expect((screen.getByLabelText(/^Role name/) as HTMLInputElement).value).toBe("");
  });
});
