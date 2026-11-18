// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PasswordSetFeedback } from "@/features/auth/components/password-set-feedback";

afterEach(cleanup);

describe("PasswordSetFeedback", () => {
  it("renders the success status alert", () => {
    render(<PasswordSetFeedback />);

    const alert = screen.getByRole("status");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Password set successfully");
    expect(alert.textContent).toContain(
      "Your password has been saved. Please sign in below with your email and new password to access your CertTracker account."
    );
  });
});
