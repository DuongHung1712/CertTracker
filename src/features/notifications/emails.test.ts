import { describe, expect, it } from "vitest";
import { buildExpiryEmail, buildMonthlyEmail } from "@/features/notifications/emails";
import type { ExpiryAlert, ExpiryItem } from "@/features/notifications/expiry-plan";
import type { Kpi, MonthlyReport } from "@/features/notifications/monthly-plan";

const item = (n: number, memberName = `Member ${n}`): ExpiryItem => ({
  recordId: `r${n}`,
  memberId: `m${n}`,
  memberName,
  memberCode: `MC${n}`,
  certificateName: `Course ${n}`,
  expiryDate: "2026-11-05",
  daysToExpiry: 25,
  bucket: "soon",
});

const kpi: Kpi = {
  members: 3,
  records: 9,
  done: 6,
  inProgress: 2,
  notStarted: 1,
  valid: 5,
  expiring: 1,
  expired: 1,
  issuedInMonth: 2,
  expiredInMonth: 0,
  completionRate: 67,
};

describe("buildExpiryEmail", () => {
  it("builds a subject from the count and the period only (edge #26)", async () => {
    const evil = "<script>x</script>\r\nBcc: evil@x.co";
    const alert: ExpiryAlert = {
      email: "a@b.co",
      name: evil,
      own: [item(1, evil)],
      teams: [{ teamId: "t", teamName: evil, items: [item(2, evil), item(3, evil)] }],
    };
    const mail = await buildExpiryEmail(alert, { period: "2026-W41", appUrl: null });
    expect(mail.subject).toBe("[CertTracker] 3 certificates expire soon or have expired (Week 41, 2026)");
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.html).not.toContain("<script>");
    expect(mail.text.length).toBeGreaterThan(0);
  });

  it("uses the singular for exactly one certificate", async () => {
    const mail = await buildExpiryEmail({ email: "a@b.co", name: null, own: [item(1)], teams: [] }, { period: "2026-W41", appUrl: null });
    expect(mail.subject).toBe("[CertTracker] 1 certificate expires soon or has expired (Week 41, 2026)");
  });

  it("counts own and team rows together, not the hidden ones separately", async () => {
    const own = Array.from({ length: 30 }, (_, i) => item(i + 1));
    const mail = await buildExpiryEmail({ email: "a@b.co", name: null, own, teams: [] }, { period: "2026-W01", appUrl: null });
    expect(mail.subject).toBe("[CertTracker] 30 certificates expire soon or have expired (Week 1, 2026)");
  });
});

describe("buildMonthlyEmail", () => {
  const report: MonthlyReport = {
    email: "boss@b.co",
    name: null,
    scope: "org",
    month: "2026-09",
    overall: kpi,
    teams: [{ teamId: null, teamName: "No team", kpi }],
    upcoming: [item(1)],
  };

  it("builds the subject from the month label and the full body", async () => {
    const mail = await buildMonthlyEmail(report, { appUrl: "https://x.test", today: "2026-10-01" });
    expect(mail.subject).toBe("[CertTracker] Monthly report for September 2026");
    expect(mail.html).toContain("Figures as of 01/10/2026");
    expect(mail.html).toContain("Monthly report for September 2026");
    expect(mail.html).toContain("No team");
    expect(mail.text).toContain("Valid");
  });

  it("puts the given date into the mail", async () => {
    const mail = await buildMonthlyEmail(report, { appUrl: null, today: "2026-10-03" });
    expect(mail.html).toContain("Figures as of 03/10/2026");
    expect(mail.html).not.toContain("Figures as of 01/10/2026");
  });
});
