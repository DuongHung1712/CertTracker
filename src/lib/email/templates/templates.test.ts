import { createElement } from "react";
import { describe, expect, it } from "vitest";
import type { ExpiryAlert, ExpiryItem } from "@/features/notifications/expiry-plan";
import type { Kpi, MonthlyReport } from "@/features/notifications/monthly-plan";
import { renderEmail } from "@/lib/email/render";
import { EMAIL_THEME } from "@/lib/email/theme";
import { ExpiryAlertEmail } from "@/lib/email/templates/expiry-alert";
import { MonthlyReportEmail } from "@/lib/email/templates/monthly-report";

const item = (n: number, over: Partial<ExpiryItem> = {}): ExpiryItem => ({
  recordId: `r${n}`,
  memberId: `m${n}`,
  memberName: `Member ${n}`,
  memberCode: `MC${String(n).padStart(3, "0")}`,
  certificateName: `Certificate ${n}`,
  expiryDate: "2026-11-05",
  daysToExpiry: 25,
  bucket: "soon",
  ...over,
});

const alertOf = (over: Partial<ExpiryAlert>): ExpiryAlert => ({ email: "a@b.co", name: "An", own: [], teams: [], ...over });
const renderAlert = (alert: ExpiryAlert, appUrl: string | null = null) =>
  renderEmail(createElement(ExpiryAlertEmail, { alert, period: "2026-W41", appUrl }));

// U-7: a Vietnamese name must reach the inbox as written, not as `?`, mojibake or numeric entities.
const VIETNAMESE_NAME = "Nguyễn Thị Hằng";

const kpi = (over: Partial<Kpi> = {}): Kpi => ({
  members: 10,
  records: 40,
  done: 30,
  inProgress: 6,
  notStarted: 4,
  valid: 25,
  expiring: 3,
  expired: 2,
  issuedInMonth: 7,
  expiredInMonth: 1,
  completionRate: 75,
  ...over,
});
const reportOf = (over: Partial<MonthlyReport> = {}): MonthlyReport => ({
  email: "boss@b.co",
  name: "Sếp",
  scope: "org",
  month: "2026-09",
  overall: kpi(),
  teams: [{ teamId: "t1", teamName: "Team Alpha", kpi: kpi({ members: 10 }) }],
  upcoming: [item(1)],
  ...over,
});
const renderReport = (report: MonthlyReport, appUrl: string | null = null, asOf = "2026-10-01") =>
  renderEmail(createElement(MonthlyReportEmail, { report, appUrl, asOf }));

describe("ExpiryAlertEmail", () => {
  it("escapes user data instead of injecting markup (edge #26)", async () => {
    const evil = "<script>alert(1)</script>";
    const { html, text } = await renderAlert(
      alertOf({
        name: evil,
        own: [item(1, { certificateName: evil })],
        teams: [{ teamId: "t", teamName: evil, items: [item(2, { memberName: evil })] }],
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(text).toContain("<script>alert(1)</script>"); // text/plain shows the name literally; it is never parsed as markup
  });

  it("caps a section at 25 rows and says how many are hidden (edge #25)", async () => {
    const items = Array.from({ length: 30 }, (_, i) => item(i + 1));
    const { html } = await renderAlert(alertOf({ own: items }));
    expect(html).toContain("and 5 more certificates");
    // "Certificate N" appears once per rendered row; the first 25 are shown and the last 5 are not.
    expect(new Set(html.match(/Certificate \d+/g)).size).toBe(25);
    expect(html).toContain("Certificate 25");
    expect(html).not.toContain("Certificate 26");
    expect(html).not.toContain("Certificate 30");
  });

  it("shows no overflow line for exactly 25 rows", async () => {
    const { html } = await renderAlert(alertOf({ own: Array.from({ length: 25 }, (_, i) => item(i + 1)) }));
    expect(html).not.toContain("more certificate");
  });

  it("caps each team table on its own", async () => {
    const big = Array.from({ length: 27 }, (_, i) => item(i + 1));
    const { html } = await renderAlert(alertOf({ teams: [{ teamId: "t", teamName: "T", items: big }] }));
    expect(html).toContain("and 2 more certificates");
    expect(new Set(html.match(/MC\d{3}/g)).size).toBe(25);
  });

  it("omits every link to the app without appUrl and keeps them with one (edge #59)", async () => {
    const own = Array.from({ length: 30 }, (_, i) => item(i + 1));
    const teams = [{ teamId: "t", teamName: "T", items: own }];
    const without = await renderAlert(alertOf({ own, teams }), null);
    expect(without.html).not.toContain("href=");
    expect(without.html).not.toContain("Open CertTracker");
    expect(without.html).not.toContain("View all");

    const withUrl = await renderAlert(alertOf({ own, teams }), "https://x.test/");
    expect(withUrl.html).toContain('href="https://x.test/"');
    expect(withUrl.html).toContain("Open CertTracker");
    expect(withUrl.html).toContain('href="https://x.test/me"');
    expect(withUrl.html).toContain('href="https://x.test/records"');
  });

  it("words each bucket and formats the date as dd/MM/yyyy", async () => {
    const { html } = await renderAlert(
      alertOf({
        own: [
          item(1, { bucket: "expired", daysToExpiry: -3, expiryDate: "2026-10-01" }),
          item(2, { bucket: "soon", daysToExpiry: 25 }),
          item(3, { bucket: "in60", daysToExpiry: 45 }),
        ],
      }),
    );
    expect(html).toContain("Expired 3 days ago");
    expect(html).toContain("25 days left");
    expect(html).toContain("45 days left");
    expect(html).toContain("01/10/2026");
    expect(html).toContain("05/11/2026");
  });

  it("uses singular wording for exactly one day or one hidden certificate", async () => {
    const own = Array.from({ length: 26 }, (_, i) => item(i + 1));
    own[0] = item(1, { bucket: "expired", daysToExpiry: -1 });
    own[1] = item(2, { bucket: "soon", daysToExpiry: 1 });
    const { html } = await renderAlert(alertOf({ own }));
    expect(html).toContain("Expired 1 day ago");
    expect(html).toContain("1 day left");
    expect(html).toContain("and 1 more certificate");
    expect(html).not.toContain("1 more certificates");
  });

  it("colours each bucket from the theme", async () => {
    const { html } = await renderAlert(
      alertOf({
        own: [item(1, { bucket: "expired", daysToExpiry: -3 }), item(2, { bucket: "soon" }), item(3, { bucket: "in60", daysToExpiry: 45 })],
      }),
    );
    for (const hex of [
      EMAIL_THEME.expiredBg,
      EMAIL_THEME.expiredFg,
      EMAIL_THEME.expiringSoonBg,
      EMAIL_THEME.expiringSoonFg,
      EMAIL_THEME.expiring60Bg,
      EMAIL_THEME.expiring60Fg,
    ]) {
      expect(html.toLowerCase()).toContain(hex.toLowerCase());
    }
  });

  it("shows only the sections that have rows", async () => {
    const ownOnly = await renderAlert(alertOf({ own: [item(1)] }));
    expect(ownOnly.html).toContain("Your certificates");
    expect(ownOnly.html).not.toMatch(/Team /);

    const teamsOnly = await renderAlert(alertOf({ teams: [{ teamId: "t", teamName: "Alpha", items: [item(1)] }] }));
    expect(teamsOnly.html).toContain("Team Alpha");
    expect(teamsOnly.html).not.toContain("Your certificates");
  });

  it("greets by name, or plainly when the name is unknown", async () => {
    expect((await renderAlert(alertOf({ name: "An", own: [item(1)] }))).html).toContain("Hello An,");
    const anonymous = (await renderAlert(alertOf({ name: null, own: [item(1)] }))).html;
    expect(anonymous).toContain("Hello,");
    expect(anonymous).not.toContain("Hello null");
  });

  it("explains the window and the period", async () => {
    const { html } = await renderAlert(alertOf({ own: [item(1)] }));
    expect(html).toContain("expire within the next 60 days or expired within the last 30 days (Week 41, 2026)");
    expect(html).toContain('lang="en"');
  });

  it("renders a plain-text alternative without HTML tags", async () => {
    const { text } = await renderAlert(alertOf({ own: [item(1, { certificateName: "Chứng chỉ An toàn" })] }), "https://x.test");
    expect(text).not.toMatch(/<[a-z][\s\S]*>/i);
    expect(text).toContain("Chứng chỉ An toàn");
  });
});

describe("Vietnamese names (U-7)", () => {
  it("keeps the name intact in the expiry alert's html and text", async () => {
    const { html, text } = await renderAlert(
      alertOf({ name: VIETNAMESE_NAME, teams: [{ teamId: "t", teamName: "T", items: [item(1, { memberName: VIETNAMESE_NAME })] }] }),
    );
    expect(html).toContain(`Hello ${VIETNAMESE_NAME},`);
    expect(html).toContain(`>${VIETNAMESE_NAME} (MC001)<`); // the member's row
    expect(text).toContain(`Hello ${VIETNAMESE_NAME},`);
  });

  it("keeps the name intact in the monthly report's html and text", async () => {
    const { html, text } = await renderReport(reportOf({ name: VIETNAMESE_NAME, upcoming: [item(1, { memberName: VIETNAMESE_NAME })] }));
    expect(html).toContain(`Hello ${VIETNAMESE_NAME},`);
    expect(html).toContain(`>${VIETNAMESE_NAME} (MC001)<`); // the upcoming row
    expect(text).toContain(`Hello ${VIETNAMESE_NAME},`);
  });
});

describe("MonthlyReportEmail", () => {
  it("shows the month title, the scope note and the Dashboard KPI labels", async () => {
    const { html } = await renderReport(reportOf());
    expect(html).toContain("Monthly report for September 2026");
    expect(html).toContain("Figures for the whole organisation.");
    for (const label of ["Active members", "Certificates", "Completed", "In progress", "Valid", "Expiring within 60 days", "Expired", "Issued this month", "Expired this month"]) {
      expect(html).toContain(`>${label}<`);
    }
  });

  it("states the date the figures are as of, and follows it", async () => {
    expect((await renderReport(reportOf())).html).toContain("Figures as of 01/10/2026");
    expect((await renderReport(reportOf(), null, "2026-10-02")).html).toContain("Figures as of 02/10/2026");
  });

  it("uses the managed-teams note for a manager report", async () => {
    const { html } = await renderReport(reportOf({ scope: "teams" }));
    expect(html).toContain("Figures for the teams you manage.");
    expect(html).not.toContain("Figures for the whole organisation.");
  });

  it("shows — for an unknown completion rate and a percentage otherwise", async () => {
    const none = await renderReport(reportOf({ overall: kpi({ done: 0, records: 0, completionRate: null }), teams: [], upcoming: [] }));
    expect(none.html).toContain("0 (—)");
    const some = await renderReport(reportOf());
    expect(some.html).toContain("30 (75%)");
    expect(some.html).toContain("75%");
  });

  it("lists teams and upcoming items, and drops those sections when empty", async () => {
    const full = await renderReport(reportOf());
    expect(full.html).toContain("Team Alpha");
    expect(full.html).toContain("Expiring in the next 60 days");
    expect(full.html).toContain("Certificate 1");

    const empty = await renderReport(reportOf({ teams: [], upcoming: [] }));
    expect(empty.html).not.toContain("By team");
    expect(empty.html).not.toContain("Expiring in the next 60 days");
  });

  it("caps the upcoming list at 25 rows", async () => {
    const upcoming = Array.from({ length: 30 }, (_, i) => item(i + 1));
    const { html } = await renderReport(reportOf({ upcoming }), "https://x.test");
    expect(html).toContain("and 5 more certificates");
    expect(html).toContain('href="https://x.test/records"');
  });

  it("escapes team and member names", async () => {
    const evil = "<img src=x onerror=alert(1)>";
    const { html } = await renderReport(
      reportOf({ name: evil, teams: [{ teamId: "t1", teamName: evil, kpi: kpi() }], upcoming: [item(1, { memberName: evil })] }),
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("renders a plain-text alternative without HTML tags", async () => {
    const { text } = await renderReport(reportOf());
    expect(text).not.toMatch(/<[a-z][\s\S]*>/i);
    expect(text).toContain("Valid");
    expect(text).toContain("Team Alpha");
  });
});
