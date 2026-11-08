import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import type { AdminDashboardData } from "@/features/dashboard/load";
import type { RecordRow } from "@/features/records/queries";

vi.mock("@/features/records/components/records-realtime", () => ({
  RecordsRealtime: () => null,
}));

function mockRecord(overrides: Partial<RecordRow> = {}): RecordRow {
  return {
    id: "rec-1",
    memberId: "mem-1",
    memberCode: "M001",
    memberName: "Nguyễn Văn An",
    memberEmail: "an@example.com",
    teamId: "team-1",
    teamName: "Team Cloud",
    courseId: "course-1",
    courseName: "Cloud Architect",
    certTypeName: "Cloud",
    providerName: "AWS",
    validityMonths: 36,
    cost: null,
    costCurrency: null,
    estHours: null,
    status: "done",
    progress: 100,
    plannedExamDate: null,
    issuedDate: "2026-11-01",
    certificateUrl: null,
    hasEvidence: false,
    viaCompany: false,
    refundStatus: "n_a",
    notes: null,
    expiryDate: "2029-11-01",
    daysToExpiry: 25,
    expiryStatus: "Expiring Soon",
    ...overrides,
  };
}

const DEFAULT_DATA: AdminDashboardData = {
  greeting: "Good morning, Admin",
  subtitle: "Figures as of 08/11/2026 15:30.",
  profile: {
    fullName: "Linh Tran",
    teamName: "Team Cloud",
    careerRoleName: "Senior Engineer",
    yoeYears: 6,
  },
  kpis: {
    ok: true,
    data: {
      totalMembers: 3,
      totalRecords: 3,
      doneRecords: 1,
      inProgressRecords: 1,
      notStartedRecords: 1,
      activeCerts: 0,
      expiring60Certs: 0,
      expiringSoonCerts: 1,
      expiredCerts: 0,
      noExpiryCerts: 0,
    },
  },
  courses: {
    ok: true,
    data: [
      {
        key: "c1",
        label: "Cloud Architect",
        headcount: null,
        people: 1,
        records: 1,
        done: 1,
        inProgress: 0,
        notStarted: 0,
        valid: 1,
        expired: 0,
      },
    ],
  },
  teams: {
    ok: true,
    data: [
      {
        key: "t1",
        label: "Team Cloud",
        headcount: 2,
        people: 1,
        records: 1,
        done: 1,
        inProgress: 0,
        notStarted: 0,
        valid: 1,
        expired: 0,
      },
    ],
  },
  certTypes: {
    ok: true,
    data: [
      {
        key: "ct1",
        label: "Cloud",
        headcount: null,
        people: 1,
        records: 1,
        done: 1,
        inProgress: 0,
        notStarted: 0,
        valid: 1,
        expired: 0,
      },
    ],
  },
  providers: {
    ok: true,
    data: [
      {
        key: "p1",
        label: "AWS",
        headcount: null,
        people: 1,
        records: 1,
        done: 1,
        inProgress: 0,
        notStarted: 0,
        valid: 1,
        expired: 0,
      },
    ],
  },
  ranking: {
    ok: true,
    data: [
      {
        rank: 1,
        memberId: "m1",
        memberCode: "M001",
        fullName: "Nguyễn Văn An",
        teamName: "Team Cloud",
        doneCerts: 1,
        validCerts: 1,
        inProgress: 0,
      },
    ],
  },
  records: {
    ok: true,
    data: [mockRecord()],
  },
  dqIssues: {
    ok: true,
    data: [],
  },
};

const countOccurrences = (html: string, text: string) => html.split(text).length - 1;

describe("AdminDashboardView", () => {
  it("renders all key regions exactly once", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        greeting={DEFAULT_DATA.greeting}
        subtitle={DEFAULT_DATA.subtitle}
        profile={DEFAULT_DATA.profile}
        data={DEFAULT_DATA}
      />,
    );

    for (const regionName of [
      "Overview",
      "Certificate expiry",
      "Explorer",
      "Individual ranking",
      "Workspace ledger",
      "Quick actions",
      "Needs attention",
      "Compliance assistant and insights (Coming soon)",
      "Admin dashboard views",
    ]) {
      expect(
        countOccurrences(html, `aria-label="${regionName}"`),
        `region "${regionName}" rendered exactly once`,
      ).toBe(1);
    }
  });

  it("renders Approvals, Goals, and Skills once in the tab strip", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardView
        greeting={DEFAULT_DATA.greeting}
        subtitle={DEFAULT_DATA.subtitle}
        profile={DEFAULT_DATA.profile}
        data={DEFAULT_DATA}
      />,
    );

    expect(countOccurrences(html, 'aria-label="Approvals Soon"')).toBe(1);
    expect(countOccurrences(html, 'aria-label="Goals Soon"')).toBe(1);
    expect(countOccurrences(html, 'aria-label="Skills Soon"')).toBe(1);
  });

  it("renders profile card correctly when admin has no member record", () => {
    const noMemberProfile = {
      fullName: "admin@example.com",
      teamName: null,
      careerRoleName: null,
      yoeYears: null,
    };

    const html = renderToStaticMarkup(
      <AdminDashboardView
        greeting="Good morning, Admin"
        subtitle="Figures as of 08/11/2026 15:30."
        profile={noMemberProfile}
        data={DEFAULT_DATA}
      />,
    );

    expect(html).toContain("admin@example.com");
    expect(html).toContain("System administrator");
    expect(html).not.toContain("Role not set");
  });

  it("renders section error when queries fail", () => {
    const failedData: AdminDashboardData = {
      ...DEFAULT_DATA,
      kpis: { ok: false, error: "Failed to load KPIs" },
      ranking: { ok: false, error: "Failed to load ranking" },
      records: { ok: false, error: "Failed to load records" },
    };

    const html = renderToStaticMarkup(
      <AdminDashboardView
        greeting={failedData.greeting}
        subtitle={failedData.subtitle}
        profile={failedData.profile}
        data={failedData}
      />,
    );

    expect(html).toContain("Overview");
    expect(html).toContain("Individual ranking");
    expect(html).toContain("Needs attention");
    expect(html).toContain("Certificates earned");
    expect(html).toContain("Reload the page to try again.");
  });
});
