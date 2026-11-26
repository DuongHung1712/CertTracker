// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changePassword, setPassword, signIn } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { LoginForm } from "@/features/auth/components/login-form";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

vi.mock("@/features/auth/actions", () => ({
  signIn: vi.fn(),
  setPassword: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(cleanup);

describe("Auth forms validation and input preservation", () => {
  it("LoginForm uses noValidate, shows * Required, preserves email on invalid email submit, and marks only Email invalid", async () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
    expect(screen.getByText("* Required")).toBeTruthy();

    const email = screen.getByLabelText(/^Email/) as HTMLInputElement;
    const password = screen.getByLabelText(/^Password/) as HTMLInputElement;
    await userEvent.type(email, "not-an-email");
    await userEvent.type(password, "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    expect(email.value).toBe("not-an-email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(password.getAttribute("aria-invalid")).toBeNull();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("LoginForm preserves typed email when server returns an error", async () => {
    vi.mocked(signIn).mockResolvedValue({ ok: false, error: "Wrong email or password. Check them and try again." });
    render(<LoginForm />);

    const email = screen.getByLabelText(/^Email/) as HTMLInputElement;
    const password = screen.getByLabelText(/^Password/) as HTMLInputElement;
    await userEvent.type(email, "user@example.com");
    await userEvent.type(password, "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Wrong email or password. Check them and try again.")).toBeTruthy();
    expect(email.value).toBe("user@example.com");
  });

  it("SetPasswordForm preserves values on mismatch and marks only Confirm password invalid", async () => {
    const { container } = render(<SetPasswordForm tokenHash="tok" type="invite" />);
    expect(container.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
    expect(screen.getByText("* Required")).toBeTruthy();

    const pwd = screen.getByLabelText(/^New password/) as HTMLInputElement;
    const confirm = screen.getByLabelText(/^Confirm password/) as HTMLInputElement;
    await userEvent.type(pwd, "correct horse");
    await userEvent.type(confirm, "different horse");
    await userEvent.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByText("The two passwords do not match")).toBeTruthy();
    expect(pwd.value).toBe("correct horse");
    expect(confirm.value).toBe("different horse");
    expect(pwd.getAttribute("aria-invalid")).toBeNull();
    expect(confirm.getAttribute("aria-invalid")).toBe("true");
    expect(setPassword).not.toHaveBeenCalled();
  });

  it("ChangePasswordForm preserves inputs on error and clears only after success", async () => {
    vi.mocked(changePassword).mockResolvedValueOnce({ ok: false, error: "The current password is not correct.", field: "currentPassword" });
    const { container } = render(<ChangePasswordForm />);
    expect(container.querySelector("form")?.hasAttribute("novalidate")).toBe(true);
    expect(screen.getByText("* Required")).toBeTruthy();

    const current = screen.getByLabelText(/^Current password/) as HTMLInputElement;
    const pwd = screen.getByLabelText(/^New password/) as HTMLInputElement;
    const confirm = screen.getByLabelText(/^Confirm new password/) as HTMLInputElement;
    await userEvent.type(current, "old-pass");
    await userEvent.type(pwd, "new-password-1");
    await userEvent.type(confirm, "new-password-1");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));

    expect(await screen.findByText("The current password is not correct.")).toBeTruthy();
    expect(current.value).toBe("old-pass");
    expect(current.getAttribute("aria-invalid")).toBe("true");
    expect(pwd.getAttribute("aria-invalid")).toBeNull();

    vi.mocked(changePassword).mockResolvedValueOnce({ ok: true, data: null });
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() => expect(current.value).toBe(""));
    expect(pwd.value).toBe("");
    expect(confirm.value).toBe("");
  });
});
