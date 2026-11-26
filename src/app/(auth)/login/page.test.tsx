// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import { StyleProvider } from "@/components/style-provider";

vi.mock("@/features/auth/actions", () => ({ signIn: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

afterEach(cleanup);

describe("LoginPage", () => {
  it("renders default sign in state when passwordSet is not present", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(<StyleProvider>{page}</StyleProvider>);

    expect(screen.getByText("Sign in with the account you were given")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders success feedback alert when passwordSet is set without duplicating description copy", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({ passwordSet: "1" }) });
    render(<StyleProvider>{page}</StyleProvider>);

    expect(screen.queryByText("Password saved. Sign in with your new password.")).toBeNull();
    const alert = screen.getByRole("status");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Password set successfully");
  });

  it("pre-fills email when email search param is provided", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({ passwordSet: "1", email: "engineer@example.com" }) });
    render(<StyleProvider>{page}</StyleProvider>);

    const emailInput = screen.getByLabelText(/^Email/) as HTMLInputElement;
    expect(emailInput.value).toBe("engineer@example.com");
  });

  it("mounts StyleToggle for instant theme switching on the login screen", async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(<StyleProvider>{page}</StyleProvider>);

    const toggle = screen.getByRole("button", {
      name: /Switch visual style/i,
    });
    expect(toggle).toBeDefined();
    expect(toggle.textContent).toContain("Classic");
  });
});
