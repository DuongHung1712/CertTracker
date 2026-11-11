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

// One expired, one 20-day and one 45-day certificate (the overlap fixture for Needs attention vs Next to expire).
const RECORDS: RecordRow[] = [
  doneRecord(-3, { id: "r-exp", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "Course Expired" }),
  doneRecord(20, { id: "r-20", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "Course Twenty" }),
  doneRecord(45, { id: "r-45", memberId: "m2", memberName: "Lê Minh Châu", certificateName: "Course FortyFive" }),
  makeRecord({ id: "r-ip", memberId: "m2", memberName: "Lê Minh Châu", certificateName: "Course Planned", status: "in_progress", progress: 40, issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: null }),
];

function render({ records = RECORDS }: { records?: RecordRow[] } = {}): string {
  return renderToStaticMarkup(
    <ManagerDashboardView
      greeting="Good morning, Manager"
      subtitle="You look after Team Cloud (3 members)."
      managedTeamNames={["Team Cloud"]}
      records={records}
      members={MEMBERS}
    />,
  );
}

const count = (html: string, text: string) => html.split(text).length - 1;

/** Markup of one `<section aria-label=name>` up to its first closing tag (these regions do not nest sections). */
function region(html: string, name: string): string {
  const start = html.indexOf(`aria-label="${name}"`);
  expect(start, `region "${name}" is rendered`).toBeGreaterThanOrEqual(0);
  return html.slice(start, html.indexOf("</section>", start));
}

const textOf = (markup: string) => markup.replace(/<[^>]+>/g, "").trim();

describe("ManagerDashboardView: each region once", () => {
  it("renders every kept region exactly once", () => {
    const html = render();
    for (const name of [
      "Overview",
      "Needs attention",
      "Next to expire",
      "Team readiness",
      "Planned exams",
      "Automated reminders",
      "Ask about my team (Coming soon)",
      "Manager dashboard views",
      "Filter by team scope",
    ]) {
      expect(count(html, `aria-label="${name}"`), name).toBe(1);
    }
  });

  it("drops the duplicate ranking and the duplicate Coming soon cards", () => {
    const html = render();
    expect(html).not.toContain("Across the department");
    expect(html).not.toContain("Totals for the whole department.");
    expect(html).not.toContain("Individual ranking");
    for (const name of ["Approvals queue", "Goals", "Skills", "Risk alerts"]) {
      expect(html).not.toContain(`aria-label="${name} (Coming soon)"`);
    }
  });

  it("shows Approvals, Goals and Skills once each: one tab, plus one approvals KPI", () => {
    const html = render();
    expect(count(html, 'aria-label="Approvals Soon"')).toBe(1);
    expect(count(html, 'aria-label="Goals Soon"')).toBe(1);
    expect(count(html, 'aria-label="Skills Soon"')).toBe(1);
    expect(count(html, "Waiting for approval")).toBe(1);
    expect(count(html, ">Goals<")).toBe(1);
    expect(count(html, ">Skills<")).toBe(1);
  });

  it("offers export and View learning once (header only)", () => {
    const html = render();
    expect(count(html, "/api/export/records")).toBe(1);
    expect(count(html, ">View learning<")).toBe(1);
  });
});

describe("ManagerDashboardView: real data and real actions only", () => {
  it("contains none of the invented values", () => {
    const html = render();
    for (const fake of [
      "DAS",
      "+28%",
      "Last sent",
      "Joined",
      "Assigned Mentor",
      "Send reminder",
      "Notify member",
      "Remediate",
      "Suggest certification",
      "Review record",
      "Open queue",
      "Assign goal",
      "Pending manager action",
      "proofs queued",
      "Key person risk",
      "Subsidized exams",
      "Cloud certification coverage",
      "Approvals (2)",
      "Team member",
      "Download report",
      "Export team audit CSV",
    ]) {
      expect(html, fake).not.toContain(fake);
    }
    expect(html.toLowerCase()).not.toContain("dossier");
  });

  it("has no period selector (Month / Quarter / Year is not wired to anything)", () => {
    const html = render();
    for (const label of [">Month<", ">Quarter<", ">Year<"]) expect(html).not.toContain(label);
  });

  it("gives every link an app route and every enabled button a handler", () => {
    const html = render();
    const hrefs = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => /href="([^"]*)"/.exec(m[0])?.[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) expect(href, "every <a> has an in-app href").toMatch(/^\//);

    // Static markup cannot show onClick, so enabled buttons must be one of the known handler-bearing
    // controls: the team pills, the dossier member rows, or the current tab. (The source scan in
    // manager-copy.test.ts checks the onClick itself.)
    const allowed = new Set(["All teams", "Team Cloud", "Overview", ...MEMBERS.map((m) => m.fullName)]);
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)];
    for (const [, attrs, inner] of buttons) {
      if (/\bdisabled\b/.test(attrs)) {
        expect(attrs, "only the Soon tabs are disabled").toMatch(/role="tab"/);
        continue;
      }
      const text = textOf(inner);
      expect([...allowed].some((name) => text.startsWith(name)) || text.includes("#"), `button "${text}"`).toBe(true);
    }
    expect(html).not.toContain("<input");
  });
});

describe("ManagerDashboardView: Needs attention and Next to expire do not overlap", () => {
  it("lists the expired certificate in Needs attention and the 20- and 45-day ones in Next to expire, once each", () => {
    const html = render();
    const attention = region(html, "Needs attention");
    const next = region(html, "Next to expire");
    for (const course of ["Course Expired", "Course Twenty", "Course FortyFive"]) {
      expect(count(attention, course) + count(next, course), course).toBe(1);
    }
    expect(attention).toContain("Course Expired");
    expect(next).toContain("Course Twenty");
    expect(next).toContain("Course FortyFive");
  });

  it("names the most overdue certificate in the Expired tile, not the first one in the list", () => {
    const html = render({
      records: [
        doneRecord(-3, { id: "a", memberName: "Recent Lapse", certificateName: "Course A" }),
        doneRecord(-40, { id: "b", memberName: "Long Lapse", certificateName: "Course B" }),
      ],
    });
    expect(region(html, "Overview")).toContain("Past due: Long Lapse (Course B)");
  });
});

describe("ManagerDashboardView: automated reminders", () => {
  it("states the two scheduled facts from vercel.json and nothing else", () => {
    const reminders = region(render(), "Automated reminders");
    expect(reminders).toContain("Members get an expiry email every Monday at 08:00 (Vietnam time).");
    expect(reminders).toContain("The monthly report goes out on the 1st of each month.");
    // /settings is admin-only (nav.ts), so the card links nowhere.
    expect(reminders).not.toContain("<a ");
  });
});

describe("ManagerDashboardView: failures are not shown as empty", () => {
  it("shows an error, not 'No teams assigned yet', when the teams could not be loaded", () => {
    const html = renderToStaticMarkup(
      <ManagerDashboardView
        greeting="Good morning, Manager"
        subtitle="No teams assigned yet."
        managedTeamNames={[]}
        teamsError="boom"
        records={[]}
        members={[]}
        />,
    );
    expect(html).toContain("Could not load");
    expect(html).not.toContain("No teams assigned yet</");
  });

  it("marks the selected team pill with aria-pressed", () => {
    const html = render();
    expect(count(html, 'aria-pressed="true"')).toBe(1);
    expect(count(html, 'aria-pressed="false"')).toBe(1);
  });
});
