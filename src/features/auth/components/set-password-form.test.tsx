// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

vi.mock("@/features/auth/actions", () => ({
  setPassword: vi.fn(),
}));

afterEach(cleanup);

describe("SetPasswordForm", () => {
  it("renders new password inputs, save button, and guidance copy", () => {
    render(<SetPasswordForm tokenHash="test-token" type="invite" />);

    expect(screen.getByLabelText("New password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm password")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save password" })).toBeTruthy();
    expect(
      screen.getByText("After setting your password, you will be redirected to sign in with your new credentials.")
    ).toBeTruthy();
  });
});
