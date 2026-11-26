// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PasswordInput } from "@/components/password-input";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { LoginForm } from "@/features/auth/components/login-form";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";

vi.mock("@/features/auth/actions", () => ({ signIn: vi.fn(), setPassword: vi.fn(), changePassword: vi.fn() }));

afterEach(cleanup);

describe("PasswordInput", () => {
  it("hides the text by default and toggles it with an accessible, pressed-state button", async () => {
    render(<PasswordInput aria-label="Secret" />);
    const input = screen.getByLabelText<HTMLInputElement>("Secret");
    expect(input.type).toBe("password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(toggle.getAttribute("type")).toBe("button");

    await userEvent.click(toggle);
    expect(input.type).toBe("text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");

    await userEvent.click(hide);
    expect(input.type).toBe("password");
  });

  it("works from the keyboard and does not submit the form", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Secret" />
      </form>,
    );
    await userEvent.tab(); // input
    await userEvent.tab(); // toggle
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Show password" }));
    await userEvent.keyboard("{Enter}");
    expect(screen.getByLabelText<HTMLInputElement>("Secret").type).toBe("text");
    await userEvent.keyboard(" ");
    expect(screen.getByLabelText<HTMLInputElement>("Secret").type).toBe("password");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is at least 32px wide (size-8 token)", () => {
    render(<PasswordInput aria-label="Secret" />);
    expect(screen.getByRole("button", { name: "Show password" }).className).toMatch(/\bsize-8\b/);
  });
});

describe("password forms use it", () => {
  it.each([
    ["login", () => <LoginForm />, 1],
    ["set-password", () => <SetPasswordForm tokenHash="t" type="invite" />, 2],
    ["change-password", () => <ChangePasswordForm />, 3],
  ])("%s form has %i toggle(s) and starts hidden", (_name, ui, count) => {
    render(ui());
    expect(screen.getAllByRole("button", { name: "Show password" })).toHaveLength(count);
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(count);
  });

  it("the login form autofocuses Email and carries the next path", () => {
    const { container } = render(<LoginForm next="/records?search=Tran" />);
    expect(document.activeElement).toBe(screen.getByLabelText(/^Email/));
    expect(container.querySelector<HTMLInputElement>('input[name="next"]')?.value).toBe("/records?search=Tran");
  });
});
