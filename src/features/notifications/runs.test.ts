import { describe, expect, it } from "vitest";
import { emailSetupStatus, summarizeRuns } from "@/features/notifications/runs";

const row = (over: Partial<Parameters<typeof summarizeRuns>[0][number]>) => ({
  kind: "expiry-alert" as const,
  period: "2026-W41",
  status: "sent" as const,
  sentAt: "2026-10-05T01:00:05Z",
  claimedAt: "2026-10-05T01:00:04Z",
  ...over,
});

describe("summarizeRuns", () => {
  it("groups by kind and period and counts each status", () => {
    const rows = summarizeRuns([
      row({}),
      row({}),
      row({ status: "failed", sentAt: null }),
      row({ status: "pending", sentAt: null }),
      row({ period: "2026-W40" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "expiry-alert", period: "2026-W41", sent: 2, failed: 1, pending: 1 });
  });

  it("keeps the same period of two kinds apart", () => {
    const rows = summarizeRuns([row({ kind: "monthly-report", period: "2026-09" }), row({ period: "2026-09" })]);
    expect(rows.map((r) => r.kind).sort()).toEqual(["expiry-alert", "monthly-report"]);
  });

  it("labels the period in Vietnamese and lists the newest first", () => {
    const rows = summarizeRuns([
      row({ period: "2026-W40", sentAt: "2026-09-28T01:00:00Z", claimedAt: "2026-09-28T01:00:00Z" }),
      row({ kind: "monthly-report", period: "2026-09", sentAt: "2026-10-01T01:00:00Z", claimedAt: "2026-10-01T01:00:00Z" }),
      row({}),
    ]);
    expect(rows.map((r) => r.label)).toEqual(["tuần 41/2026", "tháng 09/2026", "tuần 40/2026"]);
  });

  it("breaks a tie on the last activity by the later period", () => {
    const same = { sentAt: "2026-10-05T01:00:00Z", claimedAt: "2026-10-05T01:00:00Z" };
    const rows = summarizeRuns([row({ period: "2026-W40", ...same }), row({ period: "2026-W41", ...same })]);
    expect(rows.map((r) => r.period)).toEqual(["2026-W41", "2026-W40"]);
  });

  it("compares instants, not strings, so `+00:00` and `Z` timestamps order correctly", () => {
    const rows = summarizeRuns([
      row({ period: "2026-W40", sentAt: "2026-10-05T01:00:00Z", claimedAt: "2026-10-05T01:00:00Z" }),
      row({ period: "2026-W39", sentAt: "2026-10-05T01:00:01+00:00", claimedAt: "2026-10-05T01:00:01+00:00" }),
    ]);
    expect(rows.map((r) => r.period)).toEqual(["2026-W39", "2026-W40"]);
  });

  it("uses the claim time when nothing was sent", () => {
    const [r] = summarizeRuns([row({ status: "failed", sentAt: null, claimedAt: "2026-10-05T01:00:09Z" })]);
    expect(r.lastActivityAt).toBe("2026-10-05T01:00:09Z");
  });

  it("falls back to the raw period when it cannot be labelled", () => {
    const [r] = summarizeRuns([row({ period: "not-a-period" })]);
    expect(r.label).toBe("not-a-period");
  });

  it("returns nothing for no rows", () => {
    expect(summarizeRuns([])).toEqual([]);
  });
});

describe("emailSetupStatus", () => {
  const complete = {
    RESEND_API_KEY: "re_secret",
    EMAIL_FROM: "A <a@b.co>",
    CRON_SECRET: "0123456789abcdef",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
    APP_URL: "https://certs.example.com",
  };

  it("reports presence only, never values", () => {
    const checks = emailSetupStatus(complete);
    expect(checks.every((c) => c.ok)).toBe(true);
    const text = JSON.stringify(checks);
    for (const secret of ["re_secret", "0123456789abcdef", "service-role-secret", "certs.example.com", "a@b.co"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("flags what is missing, including a CRON_SECRET that is too short", () => {
    const checks = emailSetupStatus({ CRON_SECRET: "short" });
    expect(checks.filter((c) => !c.ok).map((c) => c.id).sort()).toEqual([
      "app-url",
      "cron-secret",
      "email-from",
      "resend-key",
      "service-role-key",
    ]);
  });

  it("treats empty strings as missing", () => {
    const checks = emailSetupStatus({ ...complete, RESEND_API_KEY: "" });
    expect(checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(["resend-key"]);
  });
});
