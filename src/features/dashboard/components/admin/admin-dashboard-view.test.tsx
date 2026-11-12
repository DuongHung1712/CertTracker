import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { doneRecord, noExpiryRecord } from "@/features/records/__fixtures__/record-row";
import type { RecordRow } from "@/features/records/queries";

vi.mock("@/features/records/components/records-realtime", () => ({
  RecordsRealtime: () => null,
}));

// "Issued this month" depends on today's VN month: pin the clock (2026-11-08 10:00 VN).
beforeAll(() => {
  vi.useFakeTimers({ now: new Date("2026-11-08T03:00:00Z"), toFake: ["Date"] });
});
afterAll(() => {
  vi.useRealTimers();
});

const breakdown = (key: string, label: string, headcount: number | null = null) => ({
  key,
  label,
  headcount,
  people: 1,
  records: 1,
  done: 1,
  inProgress: 0,
  notStarted: 0,
  valid: 1,
  expired: 0,
});

// One certificate issued this month that expires in 120 days: nothing needs attention.
const CALM_RECORD = doneRecord(120, {
  id: "rec-1",
  memberName: "Nguyễn Văn An",
  certificateName: "Cloud Architect",
  issuedDate: "2026-11-01",
});

const DEFAULT_DATA: AdminDashboardData = {
  greeting: "Good morning, Linh",
  subtitle: "Figures as of 08/11/2026 10:00.",
  profile: {
    fullName: "Linh Tran",
    teamName: "Team Cloud",
    careerRoleName: "Senior Engineer",
    yoeYears: 6,
  },
  profileError: undefined,
  kpis: {
    ok: true,
    data: {
      totalMembers: 3,
      totalRecords: 3,
      doneRecords: 1,
      inProgressRecords: 1,
      notStartedRecords: 1,
      activeCerts: 1,
      expiring60Certs: 0,
      expiringSoonCerts: 0,
      expiredCerts: 0,
      noExpiryCerts: 0,
      completionDoneRecords: 0,
      completionInProgressRecords: 0,
    },
  },
  certificates: { ok: true, data: [breakdown("c1", "Cloud Architect")] },
  teams: { ok: true, data: [breakdown("t1", "Team Cloud", 2)] },
  certTypes: { ok: true, data: [breakdown("ct1", "Cloud")] },
  providers: { ok: true, data: [breakdown("p1", "AWS")] },
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
  records: { ok: true, data: [CALM_RECORD] },
  dqIssues: { ok: true, data: [] },
};

const UNLINKED_PROFILE = {
  fullName: "admin@certtracker.test",
  teamName: null,
  careerRoleName: null,
  yoeYears: null,
};

const failed = { ok: false as const, error: "boom" };

// The page renders `<AdminDashboardView {...data} />` (no AdminDashboard wrapper).
function render(overrides: Partial<AdminDashboardData> = {}): string {
  const data: AdminDashboardData = { ...DEFAULT_DATA, ...overrides };
  return renderToStaticMarkup(<AdminDashboardView {...data} />);
}

const withKpis = (patch: Partial<Extract<AdminDashboardData["kpis"], { ok: true }>["data"]>) => {
  const base = DEFAULT_DATA.kpis;
  if (!base.ok) throw new Error("fixture");
  return { ok: true as const, data: { ...base.data, ...patch } };
};

const count = (html: string, text: string) => html.split(text).length - 1;
const textOf = (markup: string) =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Outer HTML of the element whose opening tag contains `marker` (tags balanced by name). */
function elementWith(html: string, marker: string): string {
  const at = html.indexOf(marker);
  expect(at, `"${marker}" is rendered`).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<", at);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(start))?.[1] ?? "";
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return html.slice(start);
}

const region = (html: string, name: string) => elementWith(html, `aria-label="${name}"`);
const column = (html: string, id: "col-center" | "col-right" | "col-left") =>
  elementWith(html, `data-testid="${id}"`);

const REGIONS = [
  "Overview",
  "Certificate expiry",
  "Admin dashboard views",
  "Explorer",
  "Needs attention",
  "Planned features (Coming soon)",
  "Your profile",
  "Quick actions",
  "Individual ranking",
];

describe("AdminDashboardView: composition (layout option B)", () => {
  it("renders every region exactly once", () => {
    const html = render();
    for (const name of REGIONS) {
      expect(count(html, `aria-label="${name}"`), `region "${name}"`).toBe(1);
    }
    expect(count(html, "Certificates earned by month:"), "monthly chart").toBe(1);
  });

  it("drops the old region names", () => {
    const html = render();
    expect(html).not.toContain("Workspace ledger");
    expect(html).not.toContain("Compliance assistant and insights");
  });

  it("puts KPIs full width above the grid and the ranking full width below it", () => {
    const html = render();
    const columns = ["col-center", "col-right", "col-left"] as const;
    for (const id of columns) {
      const col = column(html, id);
      expect(col, `${id} has no Overview`).not.toContain('aria-label="Overview"');
      expect(col, `${id} has no ranking`).not.toContain('aria-label="Individual ranking"');
    }
    expect(html.indexOf('aria-label="Overview"')).toBeLessThan(html.indexOf('data-testid="col-center"'));
    const lastColumnEnd = Math.max(
      ...columns.map((id) => html.indexOf(column(html, id)) + column(html, id).length),
    );
    expect(html.indexOf('aria-label="Individual ranking"')).toBeGreaterThan(lastColumnEnd);
  });

  it("places each widget in its column, centre first in the DOM (mobile order)", () => {
    const html = render();
    const center = column(html, "col-center");
    const right = column(html, "col-right");
    const left = column(html, "col-left");

    expect(center).toContain('aria-label="Admin dashboard views"');
    expect(center).toContain('aria-label="Explorer"');
    expect(right).toContain('aria-label="Needs attention"');
    expect(right).toContain('aria-label="Planned features (Coming soon)"');
    expect(left).toContain('aria-label="Your profile"');
    expect(left).toContain('aria-label="Quick actions"');
    expect(left).toContain("Certificates earned by month:");

    const order = [
      'aria-label="Overview"',
      'data-testid="col-center"',
      'aria-label="Admin dashboard views"',
      'aria-label="Explorer"',
      'data-testid="col-right"',
      'aria-label="Needs attention"',
      'aria-label="Planned features (Coming soon)"',
      'data-testid="col-left"',
      'aria-label="Your profile"',
      'aria-label="Quick actions"',
      "Certificates earned by month:",
      'aria-label="Individual ranking"',
    ].map((marker) => html.indexOf(marker));
    expect(order).toEqual([...order].sort((a, b) => a - b));

    // Desktop: left, centre, right.
    expect(center.slice(0, center.indexOf(">"))).toContain("lg:order-2");
    expect(right.slice(0, right.indexOf(">"))).toContain("lg:order-3");
    expect(left.slice(0, left.indexOf(">"))).toContain("lg:order-1");
  });

  it("renders Approvals, Goals, and Skills once in the tab strip", () => {
    const html = render();
    expect(count(html, 'aria-label="Approvals Soon"')).toBe(1);
    expect(count(html, 'aria-label="Goals Soon"')).toBe(1);
    expect(count(html, 'aria-label="Skills Soon"')).toBe(1);
  });
});

describe("AdminDashboardView: one Planned features card", () => {
  const ITEMS = [
    "Approvals",
    "Goals",
    "Skills",
    "Focus area",
    "Ask about certificates",
    "Monthly summary",
    "Risk alerts",
  ];

  it("lists the seven planned features, each ending with Not available yet.", () => {
    const html = render();
    const card = region(html, "Planned features (Coming soon)");
    const text = textOf(card);
    expect(text).toContain("Planned features");
    expect(text).toContain("Coming soon");
    for (const title of ITEMS) {
      expect(card, title).toMatch(new RegExp(`<h3[^>]*>${title}</h3>`));
    }
    expect(count(card, "Not available yet.")).toBe(ITEMS.length);
    expect(card).not.toContain("<button");
    expect(card).not.toContain("<input");
  });

  it("has no other Coming soon content: no approval tile, no profile card, no other Not available yet.", () => {
    const html = render();
    expect(html).not.toContain("Waiting for approval");
    expect(html).not.toContain("Track specialization");
    expect(count(html, "Not available yet.")).toBe(ITEMS.length);
  });
});

describe("AdminDashboardView: actions", () => {
  it("Quick actions: Add learning, Add member, Import from Excel (no export, no invite)", () => {
    const quick = region(render(), "Quick actions");
    const links = [...quick.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
      ([, href, inner]) => [textOf(inner), href],
    );
    expect(links).toEqual([
      ["Add learning", "/records"],
      ["Add member", "/members"],
      ["Import from Excel", "/import"],
    ]);
  });

  it("offers Add learning and the CSV export once each on the page", () => {
    const html = render();
    expect(count(textOf(html), "Add learning")).toBe(1);
    expect(count(html, "/api/export/records")).toBe(1);
    expect(textOf(html)).toContain("Export CSV");
    expect(html).not.toContain("Download data");
    expect(html).not.toContain("Invite");
  });

  // WCAG 2.5.3 label in name: the accessible name starts with the visible text "Filter groups".
  it("names the header filter button Filter groups", () => {
    const html = render();
    const names = [...html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)].map(
      ([, attrs, inner]) => /aria-label="([^"]*)"/.exec(attrs)?.[1] ?? textOf(inner),
    );
    expect(names.filter((name) => /^Filter groups/.test(name))).toHaveLength(1);
    expect(names).not.toContain("Filters");
  });
});

describe("AdminDashboardView: KPI copy", () => {
  it("names the valid card plainly, with the share and the completed total", () => {
    const overview = textOf(region(render(), "Overview"));
    expect(overview).toContain("Valid certificates");
    expect(overview).toMatch(/\b100% valid\b/);
    expect(overview).toContain("of 1 completed");
    expect(overview).toContain("1 certificate issued this month");
    for (const word of ["Audit", "pool", "Pool", "Timeline", "Workflow", "verified"]) {
      expect(overview, word).not.toContain(word);
    }
  });

  it("says None issued this month when the records loaded and none were issued", () => {
    const html = render({
      records: { ok: true, data: [doneRecord(120, { issuedDate: "2026-09-01" })] },
    });
    expect(textOf(region(html, "Overview"))).toContain("None issued this month");
    expect(html).not.toContain("verified");
  });

  it("labels the expiry split without symbols and the share in plain words", () => {
    const html = render({ kpis: withKpis({ expiringSoonCerts: 1, expiring60Certs: 2, doneRecords: 4 }) });
    const overview = textOf(region(html, "Overview"));
    expect(overview).toContain("Expiry");
    expect(overview).toContain("30 days or less: 1");
    expect(overview).toContain("31–60 days: 2");
    expect(overview).toMatch(/\d+% of completed/);
    expect(region(html, "Overview")).not.toContain("&lt;");
    expect(overview).not.toContain("≤");
    expect(overview).not.toMatch(/\b\d+d:/);
  });

  it("shows No expired certificates with no badge when nothing is expired", () => {
    const overview = region(render(), "Overview");
    expect(textOf(overview)).toContain("No expired certificates");
    expect(textOf(overview)).not.toContain("All certificates up to date");
    expect(overview).not.toContain("0 expired");
    expect(overview).not.toContain("Action needed");
    expect(overview).toMatch(/aria-label="No expired certificates/);
  });

  it("names expired certificates as an action, without Flagged or Requires immediate renewal", () => {
    const overview = textOf(region(render({ kpis: withKpis({ expiredCerts: 2 }) }), "Overview"));
    expect(overview).toContain("Expired");
    expect(overview).toContain("Action needed");
    expect(overview).toContain("Past expiry date. Members need to renew these.");
    expect(overview).not.toContain("Flagged");
    expect(overview).not.toContain("Requires immediate renewal");
    expect(overview).not.toContain("Audit risk");
  });

  it("summarises certificates by team, also when there are no teams", () => {
    expect(render()).toContain('aria-label="Certificates by team: Team Cloud 1"');
    expect(render({ teams: { ok: true, data: [] } })).toContain(
      'aria-label="Certificates by team: no teams yet"',
    );
  });
});

describe("AdminDashboardView: failures are never shown as data", () => {
  it("dqIssues failed: no All clear, no Nothing needs attention, and an error says so", () => {
    const html = render({ dqIssues: failed });
    const text = textOf(html);
    expect(text).not.toContain("All clear");
    expect(text).not.toContain("Nothing needs attention");
    expect(text).toMatch(/Could not load|could not be loaded/);
  });

  it("records failed: no issued-this-month claim, no verified, no All clear; two section errors", () => {
    const html = render({ records: failed });
    const text = textOf(html);
    expect(text).not.toContain("None issued");
    expect(text).not.toContain("issued this month");
    expect(text).not.toContain("verified");
    expect(text).not.toContain("All clear");
    expect(text).not.toContain("Nothing needs attention");
    expect(text).toContain('Could not load "Needs attention"');
    expect(text).toContain('Could not load "Certificates earned"');
    expect(count(text, "Reload the page to try again.")).toBe(2);
  });

  it("teams failed: the Overview (and its Expired card) shows no error, the Explorer does", () => {
    const html = render({ teams: failed });
    const overview = textOf(region(html, "Overview"));
    expect(overview).not.toContain("Could not load");
    expect(overview).toContain("No expired certificates");
  });

  it("profile (members or career) failed: a profile error, never System administrator", () => {
    const html = render({ profile: UNLINKED_PROFILE, profileError: "boom" });
    const text = textOf(html);
    expect(text).toContain('Could not load "Your profile"');
    expect(text).not.toContain("System administrator");
    expect(text).not.toContain("Not linked to a member");
  });

  it("an admin not linked to a member says so plainly", () => {
    const html = render({ profile: UNLINKED_PROFILE });
    const profile = textOf(region(html, "Your profile"));
    expect(profile).toContain("admin@certtracker.test");
    expect(profile).toContain("Not linked to a member");
    expect(profile).not.toContain("System administrator");
    expect(profile).not.toContain("Role not set");
  });

  it("kpis, ranking and records failed: one error per region, nothing else", () => {
    const text = textOf(render({ kpis: failed, ranking: failed, records: failed }));
    for (const title of ["Overview", "Individual ranking", "Needs attention", "Certificates earned"]) {
      expect(count(text, `Could not load "${title}"`), title).toBe(1);
    }
    expect(count(text, "Reload the page to try again.")).toBe(4);
  });

  it("no certificates at all: the No certificates yet empty state links to the certificates page", () => {
    const html = render({
      kpis: withKpis({
        totalRecords: 0,
        doneRecords: 0,
        inProgressRecords: 0,
        notStartedRecords: 0,
        activeCerts: 0,
      }),
      records: { ok: true, data: [] },
    });
    const text = textOf(html);
    expect(text).toContain("No certificates yet");
    expect(html).toMatch(/<a\b[^>]*href="\/records"[^>]*>(?:(?!<\/a>)[\s\S])*Go to certificates/);
  });
});

describe("AdminDashboardView: Needs attention", () => {
  it("says nothing needs attention in plain words, without an All clear badge", () => {
    const text = textOf(region(render(), "Needs attention"));
    expect(text).toContain("Nothing needs attention");
    expect(text).toContain("No expired certificates, none expire within 30 days, and no data problems.");
    expect(text).not.toContain("All clear");
  });

  it("lists an expired certificate (the seed has none) with a focus ring on its link", () => {
    const html = render({
      kpis: withKpis({ expiredCerts: 1 }),
      records: {
        ok: true,
        data: [doneRecord(-5, { id: "r-exp", memberName: "Trần Thị Bình", certificateName: "CKA" })],
      },
    });
    const attention = region(html, "Needs attention");
    expect(textOf(attention)).toContain("Trần Thị Bình · CKA");
    expect(textOf(attention)).toContain("Expired 5 days ago");
    const links = [...attention.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
    expect(links.length).toBeGreaterThan(0);
    for (const tag of links) {
      expect(tag).toMatch(/href="\/records\?search=/);
      expect(tag).toContain("focus-visible:ring");
    }
  });

  it("names data quality plainly", () => {
    const text = textOf(region(render({ dqIssues: { ok: true, data: [{} as never] } }), "Needs attention"));
    expect(text).toContain("Data quality");
    expect(text).toContain("1 issue to check");
    expect(text).not.toContain("Data quality issues");
    expect(text).not.toContain("requires attention");
  });

  it("keeps the data quality item when the list is cut, and links to all certificates", () => {
    const expired: RecordRow[] = Array.from({ length: 12 }, (_, i) =>
      doneRecord(-(i + 1), { id: `exp-${i}`, memberName: `Member ${i}`, certificateName: `Course ${i}` }),
    );
    const html = render({
      kpis: withKpis({ expiredCerts: 12 }),
      records: { ok: true, data: expired },
      dqIssues: { ok: true, data: [{} as never] },
    });
    const attention = region(html, "Needs attention");
    const text = textOf(attention);
    expect(text).toContain("1 issue to check");
    expect(text).toContain("Showing 10 of 12. View all certificates");
    expect(attention).toMatch(/<a\b[^>]*href="\/records"[^>]*>(?:(?!<\/a>)[\s\S])*View all certificates/);
    expect(count(attention, "Expired ")).toBe(10);
  });
});

describe("AdminDashboardView: accessibility of the KPI row", () => {
  it("derives the ring dash length from its radius", () => {
    const overview = region(render(), "Overview");
    const r = Number(/<circle[^>]*\br="([\d.]+)"/.exec(overview)?.[1]);
    const dash = Number(/stroke-dasharray="([\d.]+)"/.exec(overview)?.[1]);
    expect(r).toBeGreaterThan(0);
    expect(dash).toBeCloseTo(2 * Math.PI * r, 2);
  });

  // Shortcut: a lazy regex per <div>; fine while dl children hold no nested div before their dt/dd.
  it("keeps every description list valid: each div holds a dt and a dd", () => {
    const overview = region(render(), "Overview");
    const lists = [...overview.matchAll(/<dl\b[^>]*>([\s\S]*?)<\/dl>/g)].map(([, inner]) => inner);
    expect(lists.length).toBeGreaterThan(0);
    for (const inner of lists) {
      for (const [div, body] of inner.matchAll(/<div\b[^>]*>([\s\S]*?)<\/div>/g)) {
        expect(body, div).toMatch(/<dt\b/);
        expect(body, div).toMatch(/<dd\b/);
      }
    }
  });

  it("gives the expiry split one accessible summary, not an image plus a repeated list", () => {
    const expiry = region(render(), "Certificate expiry");
    expect(expiry).toMatch(/role="img"[^>]*aria-label="Certificate expiry:|aria-label="Certificate expiry:[^"]*"[^>]*role="img"/);
    expect(expiry).not.toContain("<ul");
    expect(expiry).not.toContain("<li");
  });
});

describe("AdminDashboardView: exam certificates and course completions are separate groups", () => {
  const completion = (id: string, patch: Parameters<typeof noExpiryRecord>[0]) =>
    noExpiryRecord({ id, certificateKind: "completion", ...patch });
  const group = (html: string, name: string) => elementWith(html, `role="group" aria-label="${name}"`);

  it("renders the two groups inside Overview", () => {
    const overview = region(render(), "Overview");
    expect(count(overview, 'role="group"')).toBe(2);
    expect(textOf(group(overview, "Exam certificates"))).toContain("Valid certificates");
    expect(textOf(group(overview, "Course completions"))).not.toContain("Valid certificates");
  });

  it("counts completions this month, this quarter and in progress, and keeps them out of the exam group", () => {
    const records = [
      CALM_RECORD,
      completion("c1", { status: "done", issuedDate: "2026-11-02" }),
      completion("c2", { status: "done", issuedDate: "2026-10-12" }),
      completion("c3", { status: "in_progress", issuedDate: null, progress: 30 }),
    ];
    const html = render({
      records: { ok: true, data: records },
      kpis: withKpis({ doneRecords: 3, inProgressRecords: 1, completionDoneRecords: 2, completionInProgressRecords: 1 }),
    });
    const completions = textOf(group(region(html, "Overview"), "Course completions"));
    expect(completions).toContain("Completed, all time 2");
    expect(completions).toContain("Completed this month 1");
    expect(completions).toContain("Completed this quarter 2");
    expect(completions).toContain("Completions in progress 1");
    // The valid card divides by exam certificates only: 3 done minus 2 completions.
    expect(textOf(group(region(html, "Overview"), "Exam certificates"))).toContain("of 1 completed");
    expect(textOf(group(region(html, "Overview"), "Exam certificates"))).toContain("In progress 0");
  });

  it("counts planned exams in the next 60 days in the exam group, not planned finish dates, and shows a dash when the list failed", () => {
    const planned = (id: string, kind: "exam" | "completion") =>
      doneRecord(120, { id, certificateKind: kind, status: "in_progress", plannedExamDate: "2026-11-20" });
    const html = render({ records: { ok: true, data: [planned("e1", "exam"), planned("e2", "exam"), planned("c1", "completion")] } });
    expect(textOf(group(region(html, "Overview"), "Exam certificates"))).toContain("Planned exams 2");
    const failedHtml = render({ records: failed });
    expect(textOf(group(region(failedHtml, "Overview"), "Exam certificates"))).toContain("Planned exams —");
  });

  it("shows a dash for the monthly figures when the certificate list failed to load", () => {
    const completions = textOf(group(region(render({ records: failed }), "Overview"), "Course completions"));
    expect(completions).toContain("Completed this month —");
    expect(completions).toContain("Completions in progress 0");
  });
});
