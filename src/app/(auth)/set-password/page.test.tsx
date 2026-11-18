// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SetPasswordPage from "@/app/(auth)/set-password/page";

vi.mock("@/features/auth/components/set-password-form", () => ({
  SetPasswordForm: () => <div data-testid="set-password-form">Mock Form</div>,
}));

afterEach(cleanup);

describe("SetPasswordPage", () => {
  it("renders the set password form for valid invite link", async () => {
    const page = await SetPasswordPage({
      searchParams: Promise.resolve({ token_hash: "valid-hash", type: "invite" }),
    });
    render(page);

    expect(screen.getByText("Set your password")).toBeTruthy();
    expect(screen.getByText("Choose a password for your CertTracker account")).toBeTruthy();
    expect(screen.getByTestId("set-password-form")).toBeTruthy();
  });

  it("renders invalid link message when token_hash or type is missing or wrong", async () => {
    const page = await SetPasswordPage({
      searchParams: Promise.resolve({ token_hash: "", type: "invalid" }),
    });
    render(page);

    expect(screen.getByText("This link is not valid. Ask your admin for a new one.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toBeTruthy();
    expect(screen.queryByTestId("set-password-form")).toBeNull();
  });
});
