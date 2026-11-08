import { describe, expect, it } from "vitest";
import { createEmailSender, EmailConfigError } from "@/lib/email/sender";

describe("createEmailSender", () => {
  it("uses the console transport outside production when no key is set", () => {
    expect(createEmailSender({ NODE_ENV: "development" }).transport).toBe("console");
  });
  it("uses Resend when configured", () => {
    expect(createEmailSender({ NODE_ENV: "production", RESEND_API_KEY: "re_x", EMAIL_FROM: "A <a@b.co>" }).transport).toBe("resend");
  });
  it("uses Resend outside production too when a key is set", () => {
    expect(createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "re_x", EMAIL_FROM: "A <a@b.co>" }).transport).toBe("resend");
  });
  it("refuses production without a key or a sender address (edge #57)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production", EMAIL_FROM: "A <a@b.co>" })).toThrow(EmailConfigError);
    expect(() => createEmailSender({ NODE_ENV: "production", RESEND_API_KEY: "re_x" })).toThrow(EmailConfigError);
  });
  it("refuses the console transport in production (edge #58)", () => {
    expect(() => createEmailSender({ NODE_ENV: "production", EMAIL_TRANSPORT: "console" })).toThrow(EmailConfigError);
  });
  it("lets EMAIL_TRANSPORT=console win over a configured key outside production", () => {
    expect(createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "re_x", EMAIL_TRANSPORT: "console" }).transport).toBe("console");
  });
  it("rejects an unknown EMAIL_TRANSPORT", () => {
    expect(() => createEmailSender({ NODE_ENV: "development", EMAIL_TRANSPORT: "smtp" })).toThrow(EmailConfigError);
  });
  it("with EMAIL_TRANSPORT=resend still requires the key", () => {
    expect(() => createEmailSender({ NODE_ENV: "development", EMAIL_TRANSPORT: "resend", EMAIL_FROM: "A <a@b.co>" })).toThrow(EmailConfigError);
  });
  it("with a key but no EMAIL_FROM outside production still refuses instead of falling back to console", () => {
    expect(() => createEmailSender({ NODE_ENV: "development", RESEND_API_KEY: "re_x" })).toThrow(EmailConfigError);
  });
});
