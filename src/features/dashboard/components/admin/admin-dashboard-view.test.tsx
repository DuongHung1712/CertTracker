import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "@/features/dashboard/components/admin/admin-dashboard-view";
import type { AdminDashboardData } from "@/features/dashboard/load";
import { doneRecord } from "@/features/records/__fixtures__/record-row";
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
      waitingRecords: 0,
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
  learningError: undefined,
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

describe("AdminDashboardView: composition", () => {
  it("shows the overview, what needs attention and the explorer once each, and nothing else of the old dashboard", () => {
    const html = render();
    for (const name of ["Overview", "Needs attention", "Explorer"]) {
      expect(count(html, `aria-label="${name}"`), `region "${name}"`).toBe(1);
    }
    for (const gone of ["Your profile", "Quick actions", "Planned features", "Admin dashboard views", "Certificates earned by month", "Course completions", "Active members"]) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it("puts four tiles in a row: waiting for approval, valid, expiring, expired", () => {
    const overview = textOf(region(render(), "Overview"));
    const order = ["Waiting for approval", "Valid certificates", "Expiring in 60 days", "Expired"].map((label) => overview.indexOf(label));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(count(region(render(), "Overview"), 'data-slot="kpi-tile"'), "summary tiles").toBe(3);
    expect(region(render(), "Overview")).toContain('href="/records?approval=waiting"');
  });

  it("keeps the individual ranking one click away: a closed details element at the bottom, after the explorer", () => {
    const html = render();
    const ranking = elementWith(html, "<details");
    expect(ranking).not.toMatch(/<details[^>]*\sopen/);
    expect(textOf(ranking)).toContain("Individual ranking");
    expect(textOf(ranking)).toContain("Nguyễn Văn An");
    expect(html.indexOf("<details")).toBeGreaterThan(html.indexOf('aria-label="Explorer"'));
  });

  it("opens the explorer on the team tab", () => {
    expect(textOf(region(render(), "Explorer"))).toContain("Team Cloud");
  });
});

describe("AdminDashboardView: the four tiles", () => {
  it("says how many of the completed certificates are valid, and how many members there are", () => {
    const text = textOf(region(render(), "Overview"));
    expect(text).toContain("Valid certificates 1 of 1 completed · 100% 3 active members");
  });

  it("says so when nothing is completed yet", () => {
    const html = render({ kpis: withKpis({ doneRecords: 0, activeCerts: 0 }) });
    expect(textOf(region(html, "Overview"))).toContain("No completed certificates yet");
  });

  it("counts what expires within 60 days and how much of it is within 30", () => {
    const html = render({ kpis: withKpis({ expiringSoonCerts: 2, expiring60Certs: 3 }) });
    expect(textOf(region(html, "Overview"))).toContain("Expiring in 60 days 5 2 within 30 days");
    expect(region(html, "Overview")).toContain("border-[var(--status-expiring-soon-border)]");
  });

  it("is calm when nothing expires, and names expired certificates as the thing to act on", () => {
    expect(textOf(region(render(), "Overview"))).toContain("Nothing expiring soon");
    expect(textOf(region(render(), "Overview"))).toContain("Expired 0 Nothing has expired All up to date");
    const html = render({ kpis: withKpis({ expiredCerts: 4 }) });
    expect(textOf(region(html, "Overview"))).toContain("Expired 4 Past the expiry date Members need to renew these");
    expect(region(html, "Overview")).toContain("border-[var(--status-expired-border)]");
    expect(html).not.toMatch(/Flagged|Requires immediate renewal/);
  });
});

describe("AdminDashboardView: failures are never shown as data", () => {
  it("dqIssues failed: no Nothing needs attention, and an error says so", () => {
    const text = textOf(region(render({ dqIssues: failed }), "Needs attention"));
    expect(text).not.toContain("Nothing needs attention");
    expect(text).toContain("Data quality could not be loaded");
  });

  it("records failed: the needs-attention card is an error, never an all clear", () => {
    const html = render({ records: failed });
    expect(textOf(html)).toContain('Could not load "Needs attention"');
    expect(html).not.toContain("Nothing needs attention");
    expect(html).not.toContain("All clear");
  });

  it("teams failed: the overview still shows its numbers, the explorer reports the error", () => {
    const html = render({ teams: failed });
    expect(textOf(region(html, "Overview"))).not.toContain("Could not load");
    expect(textOf(region(html, "Overview"))).toContain("Valid certificates");
  });

  it("ranking failed: the error is inside the ranking, nothing else is lost", () => {
    const html = render({ ranking: failed });
    expect(textOf(elementWith(html, "<details"))).toContain('Could not load "Individual ranking"');
    expect(textOf(region(html, "Overview"))).toContain("Valid certificates");
  });

  it("kpis failed: one error for the overview and nothing else is blanked", () => {
    const html = render({ kpis: failed });
    expect(count(textOf(html), 'Could not load "Overview"')).toBe(1);
    expect(textOf(html)).toContain("Needs attention");
  });

  it("no certificates at all: the No certificates yet empty state links to the certificates page and hides Filter Explorer", () => {
    const html = render({ kpis: withKpis({ totalRecords: 0, doneRecords: 0 }) });
    expect(textOf(html)).toContain("No certificates yet");
    expect(html).toMatch(/<a\b[^>]*href="\/records"[^>]*>\s*Go to certificates/);
    expect(html).not.toContain("Filter Explorer");
  });

  it("learningError: shows a warning alert when learning items could not be loaded", () => {
    const html = render({ learningError: "boom" });
    expect(textOf(html)).toContain("Learning items could not be loaded");
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

  it("lists catalogue proposals as their own row, and keeps them out of the data quality count", () => {
    const html = render({
      dqIssues: { ok: true, data: [{ type: "certificate_proposal" } as never, { type: "course_proposal" } as never, { type: "certificate_no_validity" } as never] },
    });
    const attention = region(html, "Needs attention");
    expect(textOf(attention)).toContain("Catalogue proposals");
    expect(textOf(attention)).toContain("2 proposals waiting for approval");
    expect(textOf(attention)).toContain("1 issue to check");
    expect(attention).toContain('href="/data-quality?type=proposals"');
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
