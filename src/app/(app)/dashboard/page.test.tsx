import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BreakdownRow, DashboardKpis, RankingRow } from "@/features/dashboard/schema";

// Renders the real DashboardPage (admin path) with its data sources stubbed, so the page's own
// "SectionError / chart error vs content" decisions are what is under test (review issue #3).
const getCurrentUser = vi.fn();
const getDashboardKpis = vi.fn<() => Promise<DashboardKpis>>();
const getBreakdown = vi.fn<(dimension: string, limit?: number) => Promise<BreakdownRow[]>>();
const getRanking = vi.fn<() => Promise<RankingRow[]>>();

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: () => getCurrentUser() }));
vi.mock("@/features/dashboard/queries", () => ({
  getDashboardKpis: () => getDashboardKpis(),
  getBreakdown: (dimension: string, limit?: number) => getBreakdown(dimension, limit),
  getRanking: () => getRanking(),
}));
vi.mock("@/features/records/components/records-realtime", () => ({ RecordsRealtime: () => null }));
vi.mock("@/features/members/queries", () => ({
  listMembers: vi.fn(async () => []),
  listTeamOptionsForCurrentUser: vi.fn(async () => [{ id: "t1", name: "Team Zephyr" }]),
}));
vi.mock("@/features/career/queries", () => ({ getMemberCareer: vi.fn(async () => ({})) }));
vi.mock("@/features/records/queries", () => ({
  listRecords: vi.fn(async () => []),
  listCertificateOptions: vi.fn(async () => []),
  listStudyCourses: vi.fn(async () => []),
}));
// The member view pulls in server actions; the admin path never renders it.
vi.mock("@/features/dashboard/components/member/member-dashboard-view", () => ({
  MemberDashboardView: () => null,
}));

const { default: DashboardPage } = await import("./page");

const KPIS: DashboardKpis = {
  totalMembers: 7,
  totalRecords: 4321,
  doneRecords: 30,
  inProgressRecords: 5,
  notStartedRecords: 2,
  activeCerts: 10,
  expiring60Certs: 4,
  expiringSoonCerts: 3,
  expiredCerts: 6,
  noExpiryCerts: 7,
};

function row(key: string, label: string): BreakdownRow {
  return {
    key,
    label,
    headcount: null,
    people: 3,
    records: 9,
    done: 6,
    inProgress: 2,
    notStarted: 1,
    valid: 4,
    expired: 2,
  };
}

const ROWS: Record<string, BreakdownRow[]> = {
  team: [row("t1", "Team Zephyr")],
  cert_type: [row("ct1", "Kind Quasar")],
  provider: [row("p1", "Vendor Nimbus")],
  certificate: [row("c1", "Course Orion")],
};

const RANKING: RankingRow[] = [
  {
    memberId: "00000000-0000-0000-0000-000000000001",
    memberCode: "M001",
    fullName: "Ranked Person",
    teamName: "Team Zephyr",
    validCerts: 3,
    doneCerts: 4,
    inProgress: 1,
    rank: 1,
  },
];

const fail = () => Promise.reject(new Error("boom"));

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await DashboardPage());
}

/** Markup from `<section aria-label="title">` to the end of the page (sections render in a fixed order). */
function sectionHtml(html: string, title: string): string {
  const start = html.indexOf(`aria-label="${title}"`);
  expect(start, `section "${title}" is rendered`).toBeGreaterThanOrEqual(0);
  return html.slice(start);
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  getCurrentUser.mockResolvedValue({ id: "u1", email: "admin@certtracker.test", role: "admin", memberId: null });
  getDashboardKpis.mockResolvedValue(KPIS);
  getBreakdown.mockImplementation(async (dimension) => ROWS[dimension]);
  getRanking.mockResolvedValue(RANKING);
});

describe("DashboardPage error isolation (admin)", () => {
  it("shows content and no error text when every query succeeds", async () => {
    const html = await renderPage();
    expect(html).toContain("4,321");
    expect(html).not.toContain("Could not load chart.");
    expect(html).not.toContain("Could not load &quot;");
    expect(html).toContain("Team Zephyr");
    expect(html).toContain("Ranked Person");
  });

  it("shows the Overview SectionError when the KPI query fails, and keeps the other sections", async () => {
    getDashboardKpis.mockImplementation(fail);
    const html = await renderPage();
    expect(html).toContain("Could not load &quot;Overview&quot;");
    expect(html).not.toContain("4,321");
    expect(html).toContain("Team Zephyr"); // Explorer still renders
    expect(html).toContain("Ranked Person"); // Ranking still renders
  });

  it("keeps the hero numbers and shows no chart error in Overview when the team breakdown fails", async () => {
    getBreakdown.mockImplementation(async (dimension) => {
      if (dimension === "team") throw new Error("boom");
      return ROWS[dimension];
    });
    const html = await renderPage();
    const overview = sectionHtml(html, "Overview");
    expect(overview).toContain("4,321");
    expect(overview).not.toContain("Could not load chart.");
    expect(html).not.toContain("Could not load &quot;Overview&quot;");
  });

  it("one failing Explorer tab shows its SectionError without blanking the other tabs", async () => {
    getBreakdown.mockImplementation(async (dimension) => {
      if (dimension === "team") throw new Error("boom");
      return ROWS[dimension];
    });
    const html = await renderPage();
    const explorer = sectionHtml(html, "Explorer");
    expect(explorer).toContain("Could not load &quot;By team&quot;");
    expect(explorer).not.toContain("No data yet");
    // The other tabs are still offered, with their loaded counts.
    for (const label of ["By certificate type", "By provider", "Popular certificates"]) {
      expect(explorer).toContain(label);
    }
    expect(html).not.toContain("Could not load &quot;Explorer&quot;");
  });

  it("shows the ranking SectionError when only the ranking query fails", async () => {
    getRanking.mockImplementation(fail);
    const html = await renderPage();
    expect(html).toContain("Could not load &quot;Individual ranking&quot;");
    expect(html).toContain("4,321");
    expect(html).toContain("Team Zephyr");
  });
});

describe("DashboardPage (manager)", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({ id: "u2", email: "manager@certtracker.test", role: "manager", memberId: null });
    getRanking.mockClear();
  });

  it("does not load or show the individual ranking (the Team readiness list already ranks the team)", async () => {
    const html = await renderPage();
    expect(getRanking).not.toHaveBeenCalled();
    expect(html).not.toContain("Individual ranking");
    expect(html).not.toContain("Ranked Person");
    // The anonymous org totals were removed from the manager dashboard.
    expect(html).not.toContain("Across the department");
  });
});
