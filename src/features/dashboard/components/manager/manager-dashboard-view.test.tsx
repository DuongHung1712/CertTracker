import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";
import type { RecordRow } from "@/features/records/queries";

vi.mock("@/features/records/components/records-realtime", () => ({ RecordsRealtime: () => null }));

const { ManagerDashboardView } = await import("./manager-dashboard-view");

const MEMBERS = [
  { id: "m1", fullName: "Nguyễn Văn An", teamName: "Team Cloud" },
  { id: "m2", fullName: "Lê Minh Châu", teamName: "Team Cloud" },
  { id: "m3", fullName: "Phạm Thu Dung", teamName: "Team Cloud" },
];

// One expired, one 20-day and one 45-day certificate.
const RECORDS: RecordRow[] = [
  doneRecord(-3, { id: "r-exp", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "Course Expired" }),
  doneRecord(20, { id: "r-20", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "Course Twenty" }),
  doneRecord(45, { id: "r-45", memberId: "m2", memberName: "Lê Minh Châu", certificateName: "Course FortyFive" }),
  makeRecord({ id: "r-ip", memberId: "m2", memberName: "Lê Minh Châu", certificateName: "Course Planned", status: "in_progress", progress: 40, issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: null }),
];

function render({
  records = RECORDS,
  viewerMemberId,
  teams = ["Team Cloud"],
}: { records?: RecordRow[]; viewerMemberId?: string; teams?: string[] } = {}): string {
  return renderToStaticMarkup(
    <ManagerDashboardView
      greeting="Good morning, Manager"
      subtitle="You look after Team Cloud (3 members)."
      managedTeamNames={teams}
      records={records}
      members={MEMBERS}
      viewerMemberId={viewerMemberId}
    />,
  );
}

const count = (html: string, text: string) => html.split(text).length - 1;
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

/** Markup of one `<section aria-label=name>` up to its first closing tag (these regions do not nest sections). */
function region(html: string, name: string): string {
  const start = html.indexOf(`aria-label="${name}"`);
  expect(start, `region "${name}" is rendered`).toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</section>", start));
}

describe("ManagerDashboardView: waiting tile", () => {
  const waiting = (id: string, memberId: string) => makeRecord({ id, memberId, approval: "waiting" });
  const tile = (html: string) => textOf(html.slice(html.indexOf('href="/records?approval=waiting"'), html.indexOf("</a>", html.indexOf('href="/records?approval=waiting"'))));

  it("does not count the manager's own waiting item", () => {
    const records = [waiting("w1", "m2"), waiting("w2", "m1")];
    expect(tile(render({ records, viewerMemberId: "m1" }))).toContain("Waiting for approval 1 Completed items to check");
    expect(tile(render({ records }))).toContain("Waiting for approval 2 Completed items to check");
  });
});

describe("ManagerDashboardView: composition", () => {
  it("shows the overview, what needs attention and the team, once each", () => {
    const html = render();
    for (const name of ["Overview", "Needs attention", "My team"]) {
      expect(count(html, `aria-label="${name}"`), name).toBe(1);
    }
  });

  it("drops what the manager can find elsewhere or does not need", () => {
    const html = textOf(render());
    for (const gone of [
      "Allocated scope",
      "Quick actions",
      "Automated reminders",
      "Ask about my team",
      "Certificates earned",
      "Planned exams",
      "Next to expire",
      "People without certificates",
      "Team readiness",
      "Course completions",
      "Soon",
    ]) {
      expect(html, gone).not.toContain(gone);
    }
  });

  it("puts the four tiles in a row: waiting, expiring, expired, team ready", () => {
    const overview = textOf(region(render(), "Overview"));
    const order = ["Waiting for approval", "Expiring in 60 days", "Expired", "Team ready"].map((label) => overview.indexOf(label));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("offers export and View learning once (header only)", () => {
    const html = render();
    expect(count(html, "/api/export/records")).toBe(1);
    expect(count(html, ">View learning<")).toBe(1);
  });
});

describe("ManagerDashboardView: the four tiles", () => {
  it("counts what expires within 60 days and how much is within 30, and what has expired", () => {
    const overview = textOf(region(render(), "Overview"));
    expect(overview).toContain("Expiring in 60 days 2 1 within 30 days");
    expect(overview).toContain("Expired 1 Past the expiry date");
  });

  it("says how ready the team is and how many members have no certificate", () => {
    const overview = textOf(region(render(), "Overview"));
    // Three completed certificates, two of them still valid.
    expect(overview).toContain("Team ready 66% 2 of 3 certificates valid");
    expect(overview).toContain("1 member without a certificate");
  });

  it("shows a dash, not 0%, when nothing is completed yet", () => {
    const overview = textOf(region(render({ records: [] }), "Overview"));
    expect(overview).toContain("Team ready — No certificates yet");
    expect(overview).toContain("3 members without a certificate");
  });
});

describe("ManagerDashboardView: Needs attention and My team", () => {
  it("lists the expired and the soon-to-expire certificates once each, expired first, and the member with none", () => {
    const attention = textOf(region(render(), "Needs attention"));
    for (const course of ["Course Expired", "Course Twenty", "Course FortyFive"]) {
      expect(count(attention, course), course).toBe(1);
    }
    expect(attention.indexOf("Course Expired")).toBeLessThan(attention.indexOf("Course Twenty"));
    expect(attention).toContain("Phạm Thu Dung No certificate yet");
  });

  it("lists every member of the team with a status", () => {
    const team = textOf(region(render(), "My team"));
    for (const member of MEMBERS) expect(team, member.fullName).toContain(member.fullName);
    expect(team).toContain("Needs renewal");
    expect(team).toContain("No certificate yet");
  });
});

describe("ManagerDashboardView: one team or several", () => {
  it("has no team filter and no team column for a manager of one team", () => {
    const html = render();
    expect(html).not.toContain('aria-label="Filter by team scope"');
    expect(textOf(region(html, "My team"))).not.toMatch(/Member Team/);
  });

  it("offers the team filter and a team column when there are several teams", () => {
    const html = render({ teams: ["Team Cloud", "Team AI"] });
    expect(count(html, 'aria-label="Filter by team scope"')).toBe(1);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(textOf(region(html, "My team"))).toMatch(/Member Team/);
  });
});

describe("ManagerDashboardView: real data and real actions only", () => {
  it("contains none of the invented values", () => {
    const html = render();
    for (const fake of ["DAS", "+28%", "Last sent", "Joined", "Assigned Mentor", "Send reminder", "Notify member", "Remediate", "Review record", "Open queue", "Assign goal", "Key person risk", "Download report", "Export team audit CSV"]) {
      expect(html, fake).not.toContain(fake);
    }
    expect(html.toLowerCase()).not.toContain("dossier");
  });

  it("gives every link an app route, and has no button or input of its own for a single team", () => {
    const html = render();
    const hrefs = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => /href="([^"]*)"/.exec(m[0])?.[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href, "every <a> has an in-app href").toMatch(/^\//);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<button");
  });
});

describe("ManagerDashboardView: failures are not shown as empty", () => {
  it("shows an error, not 'No teams assigned yet', when the teams could not be loaded", () => {
    const html = renderToStaticMarkup(
      <ManagerDashboardView greeting="Good morning, Manager" subtitle="No teams assigned yet." managedTeamNames={[]} teamsError="boom" records={[]} members={[]} />,
    );
    expect(html).toContain("Could not load");
    expect(html).not.toContain("No teams assigned yet</");
  });

  it("shows one error per section, never an all clear, when the records could not be loaded", () => {
    const html = renderToStaticMarkup(
      <ManagerDashboardView greeting="Good morning, Manager" subtitle="x" managedTeamNames={["Team Cloud"]} records={[]} recordsError="boom" members={MEMBERS} />,
    );
    const content = textOf(html);
    expect(content).toContain('Could not load "Overview"');
    expect(content).toContain('Could not load "Needs attention"');
    expect(content).toContain('Could not load "My team"');
    expect(content).not.toContain("Nothing to chase");
  });
});
