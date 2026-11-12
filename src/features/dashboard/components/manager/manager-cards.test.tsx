import { existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AllocatedScopeCard } from "@/features/dashboard/components/manager/allocated-scope-card";
import { AutomatedRemindersCard } from "@/features/dashboard/components/manager/automated-reminders-card";
import * as comingSoonStack from "@/features/dashboard/components/manager/manager-coming-soon-stack";
import { MonthlyEarnedChart } from "@/features/dashboard/components/manager/monthly-earned-chart";
import { NeedsAttentionFeed } from "@/features/dashboard/components/manager/needs-attention-feed";
import { NextToExpireTable } from "@/features/dashboard/components/manager/next-to-expire-table";
import { PeopleWithoutCertsCard } from "@/features/dashboard/components/manager/people-without-certs-card";
import { PlannedExamsList } from "@/features/dashboard/components/manager/planned-exams-list";
import { QuickActionsCard } from "@/features/dashboard/components/manager/quick-actions-card";
import { TeamReadinessDonutCard } from "@/features/dashboard/components/manager/team-readiness-donut-card";
import { TeamReadinessDossier } from "@/features/dashboard/components/manager/team-readiness-dossier";
import { TeamScopeFilter } from "@/features/dashboard/components/manager/team-scope-filter";
import { TopKpiRow } from "@/features/dashboard/components/manager/top-kpi-row";
import { calculateManagerKpis, getTeamReadinessLeague } from "@/features/dashboard/manager-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";

const { AskAboutMyTeamComingSoon, ManagerTabStrip } = comingSoonStack;

const count = (html: string, text: string) => html.split(text).length - 1;

describe("removed manager components (no importer after the Figma rework)", () => {
  it("deletes the old KPI cards and the readiness league (the dossier ranks the members)", () => {
    const dir = join(process.cwd(), "src/features/dashboard/components/manager");
    expect(existsSync(join(dir, "manager-kpi-cards.tsx"))).toBe(false);
    expect(existsSync(join(dir, "team-readiness-league.tsx"))).toBe(false);
  });

  it("keeps only the tab strip and one merged Coming soon card in the stack", () => {
    expect(Object.keys(comingSoonStack).sort()).toEqual(["AskAboutMyTeamComingSoon", "ManagerTabStrip"]);
  });
});

describe("NextToExpireTable", () => {
  it("renders positive empty state when no certificates are expiring within 60 days", () => {
    const records = [doneRecord(120), doneRecord(-5)];
    const html = renderToStaticMarkup(<NextToExpireTable records={records} />);
    expect(html).toContain("No upcoming expirations");
    expect(html).toContain("All completed certificates have more than 60 days of validity remaining.");
  });

  it("renders upcoming certificates with a view link and no second title inside the section", () => {
    const records = [doneRecord(25, { memberName: "Nguyễn Văn An", certificateName: "AWS SAA" })];
    const html = renderToStaticMarkup(<NextToExpireTable records={records} />);
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("AWS SAA");
    expect(html).toContain('href="/records?search=Nguy%E1%BB%85n%20V%C4%83n%20An"');
    // The Section around it already says "Next to expire".
    expect(html).not.toContain("Next to expire");
    expect(html).not.toContain("Showing urgent renewals");
  });

  it("does not invent a team name when the certificate has none", () => {
    const html = renderToStaticMarkup(<NextToExpireTable records={[doneRecord(25, { teamName: null })]} />);
    expect(html).not.toContain("Team Cloud");
  });
});

describe("PlannedExamsList", () => {
  it("renders empty state when no exams are planned", () => {
    const html = renderToStaticMarkup(<PlannedExamsList records={[]} />);
    expect(html).toContain("No upcoming exams");
  });

  it("renders upcoming exams with member, course, and view link", () => {
    const records = [
      makeRecord({
        memberName: "Trần Thị Bình",
        certificateName: "NVIDIA AI",
        plannedExamDate: "2026-11-20",
      }),
    ];
    const html = renderToStaticMarkup(<PlannedExamsList records={records} />);
    expect(html).toContain("Trần Thị Bình");
    expect(html).toContain("NVIDIA AI");
    expect(html).toContain("View");
  });
});

describe("NeedsAttentionFeed", () => {
  it("is one named region and shows a positive empty state when nothing has expired", () => {
    const html = renderToStaticMarkup(<NeedsAttentionFeed records={[doneRecord(100), doneRecord(10)]} />);
    expect(count(html, 'aria-label="Needs attention"')).toBe(1);
    expect(html).toContain("Nothing needs attention");
  });

  it("lists expired certificates only, each linking to /records (upcoming ones live in Next to expire)", () => {
    const records = [
      doneRecord(-5, { id: "e1", memberName: "Minh", certificateName: "PMP" }),
      doneRecord(10, { id: "u1", memberName: "An", certificateName: "AWS" }),
    ];
    const html = renderToStaticMarkup(<NeedsAttentionFeed records={records} />);
    expect(html).toContain("Expired certificate");
    expect(html).toContain("PMP");
    expect(html).toContain('href="/records?search=Minh"');
    expect(html).not.toContain("Expires within 30 days");
    expect(html).not.toContain("AWS");
  });

  it("has no approvals placeholder, no dead button and no invented team name", () => {
    const html = renderToStaticMarkup(
      <NeedsAttentionFeed records={[doneRecord(-5, { memberName: "Minh", teamName: null })]} />,
    );
    expect(html).not.toContain("Pending manager action");
    expect(html).not.toContain("Open queue");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Team Cloud");
    // No count badge: the list rows are the count (the Expired tile shows the number).
    expect(html).not.toMatch(/>\d+ items?</);
  });
});

describe("ManagerTabStrip & the merged Coming soon card", () => {
  it("shows Overview as the current tab and each later module once, disabled, with a Soon chip", () => {
    const html = renderToStaticMarkup(<ManagerTabStrip />);
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Overview");
    for (const name of ["Approvals Soon", "Skills Soon", "Goals Soon"]) {
      expect(count(html, `aria-label="${name}"`)).toBe(1);
    }
    expect(count(html, 'role="tab"')).toBe(4);
    expect(count(html, "disabled")).toBe(3);
    // No fake queue size; the visible name matches the accessible name (WCAG 2.5.3).
    expect(html).not.toContain("Approvals (2)");
    expect(html).not.toContain("Skill Matrix");
    expect(html).toContain(">Skills<");
  });

  it("merges Ask about my team and Risk alerts into one honest card with no data, chips or controls", () => {
    const html = renderToStaticMarkup(<AskAboutMyTeamComingSoon />);
    expect(count(html, 'aria-label="Ask about my team (Coming soon)"')).toBe(1);
    expect(html).toContain("Coming soon");
    expect(html).toMatch(/Not available yet\.<\/p>/);
    expect(html).not.toContain("Risk alerts");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<input");
    for (const fake of [
      "Cloud certification coverage?",
      "Who needs renewal in Q4?",
      "Subsidized exams available",
      "Key person risk detected",
      "View risk assessment",
      "Remediate",
    ]) {
      expect(html).not.toContain(fake);
    }
  });
});

const NO_COMPLETIONS = { doneThisMonth: 0, doneThisQuarter: 0, doneTotal: 0, inProgress: 0 };

describe("TopKpiRow: exam certificates and course completions", () => {
  it("shows two labelled groups with their own figures", () => {
    const kpis = calculateManagerKpis([doneRecord(20), doneRecord(-5), doneRecord(200)]);
    const html = renderToStaticMarkup(
      <TopKpiRow kpis={kpis} completions={{ doneThisMonth: 2, doneThisQuarter: 5, doneTotal: 9, inProgress: 3 }} plannedExams={4} />,
    );
    expect(count(html, 'role="group"')).toBe(2);
    const exam = html.slice(html.indexOf('aria-label="Exam certificates"'), html.indexOf('aria-label="Course completions"'));
    const completions = html.slice(html.indexOf('aria-label="Course completions"'));
    const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text(exam)).toContain("Valid 2");
    expect(text(exam)).toContain("Planned exams 4");
    expect(text(completions)).toContain("Completed, all time 9");
    expect(text(completions)).toContain("Completed this month 2");
    expect(text(completions)).toContain("Completed this quarter 5");
    expect(text(completions)).toContain("Completions in progress 3");
    expect(text(completions)).not.toContain("Expired");
  });
});

describe("TeamReadinessDonutCard & TopKpiRow", () => {
  it("renders the donut from certificates only: valid of completed, with no member headcount chip", () => {
    const kpis = calculateManagerKpis([doneRecord(20), doneRecord(-5)]);
    const html = renderToStaticMarkup(<TeamReadinessDonutCard kpis={kpis} noCertCount={2} />);
    expect(html).toContain("Team readiness");
    expect(html).toContain("50%");
    expect(html).toContain("1 of 2 completed certificates");
    expect(html).not.toContain("N=");
    expect(html).toContain("Members without a completed certificate");
    expect(html).not.toContain("No cert yet");
    // Valid and Expired are not repeated as legend rows (centre figure and the Expired tile show them).
    expect(html).not.toContain(">Valid<");
    expect(html).not.toContain(">Expired<");
    // The 60-day count is the KPI tile next to it, not a donut segment.
    expect(html).not.toContain("Expiring soon");
  });

  it("shows an em dash, not 0%, when there are no completed certificates", () => {
    const kpis = calculateManagerKpis([]);
    const html = renderToStaticMarkup(<TeamReadinessDonutCard kpis={kpis} noCertCount={3} />);
    expect(html).toContain("No completed certificates");
    expect(html).not.toContain("0%");
    expect(html).not.toContain("0 of 0");
    expect(html).toContain(">—<");
  });

  it("renders TopKpiRow with 3 tiles and only real numbers", () => {
    const kpis = calculateManagerKpis([doneRecord(20), doneRecord(45), doneRecord(-5)]);
    const html = renderToStaticMarkup(<TopKpiRow kpis={kpis} completions={NO_COMPLETIONS} plannedExams={0} pastDueText="Minh (PMP)" />);
    expect(html).toContain("Expiring within 60 days");
    expect(html).toContain("Expired");
    expect(html).toContain("Waiting for approval");
    expect(html).toContain("Past due: Minh (PMP)");
    // The 30-day line uses the real 30-day count (1), not the 60-day count (2), in plain words.
    expect(html).toContain("1 with 30 days or less");
    expect(html).not.toContain("≤");
    expect(html).not.toContain("Next 60 days");
    // Approvals do not exist yet: no number that looks real.
    expect(html).not.toContain("proofs queued");
    expect(html).not.toContain("All current valid");
    expect(html).toMatch(/Waiting for approval<\/dt>[\s\S]*?<dd[^>]*>—<\/dd>/);
  });
});

describe("TeamReadinessDossier", () => {
  it("ranks in-scope members and shows the selected member without invented titles or dead buttons", () => {
    const members = [
      { id: "m1", fullName: "Nguyễn Văn An", teamName: "Team Cloud" },
      { id: "m2", fullName: "Lê Minh Châu", teamName: "Team Cloud" },
    ];
    const records = [doneRecord(25, { memberId: "m1" })];
    const rows = getTeamReadinessLeague(members, records);
    const html = renderToStaticMarkup(<TeamReadinessDossier rows={rows} records={records} />);
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("#1");
    expect(html).toContain("1 valid");
    expect(html).toContain("0 valid");
    expect(html).toContain("View member certificates");
    expect(html).toContain('href="/records?search=Nguy%E1%BB%85n%20V%C4%83n%20An"');
    // The Section around it is already titled "Team readiness".
    expect(html.toLowerCase()).not.toContain("dossier");
    expect(html).not.toContain("Compliance ranking");
    expect(html).not.toContain("Team member");
    expect(html).not.toContain("Assign goal");
    expect(html).not.toMatch(/<button[^>]*disabled/);
  });
});

describe("PeopleWithoutCertsCard, AllocatedScopeCard, QuickActionsCard", () => {
  it("lists people without certificates by name and count only", () => {
    const members = [{ id: "m2", fullName: "Lê Minh Châu", teamName: "Team Cloud" }];
    const html = renderToStaticMarkup(<PeopleWithoutCertsCard members={members} />);
    expect(html).toContain("People without certificates yet");
    expect(html).toContain("(1)");
    expect(html).toContain("Lê Minh Châu");
    expect(html).not.toContain("Suggest certification");
    expect(html).not.toContain("Team member");
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("<button");
  });

  it("shows allocated scope as team names and member counts only", () => {
    const html = renderToStaticMarkup(<AllocatedScopeCard teams={[{ name: "Team Cloud", memberCount: 2 }]} />);
    expect(html).toContain("Allocated scope");
    expect(html).toContain("Team Cloud");
    expect(html).toContain("2 members");
    expect(html).not.toContain("DAS");
    expect(html).not.toContain("Program");
  });

  it("keeps only real navigation in quick actions (export lives once, in the page header)", () => {
    const html = renderToStaticMarkup(<QuickActionsCard />);
    expect(html).toContain("Quick actions");
    expect(html).toContain("Add learning");
    expect(html).toContain('href="/records"');
    expect(html).toContain("View team data quality");
    expect(html).toContain('href="/data-quality"');
    expect(html).not.toContain("Send reminder");
    expect(html).not.toContain("Export team audit CSV");
    expect(html).not.toContain("/api/export");
  });
});

describe("MonthlyEarnedChart", () => {
  it("shows the real total and no invented growth percentage", () => {
    const html = renderToStaticMarkup(<MonthlyEarnedChart records={[doneRecord(100, { issuedDate: "2023-10-01" })]} />);
    expect(html).toContain("Total earned");
    expect(html).not.toContain("+28%");
    expect(html).not.toMatch(/[+-]\d+%/);
  });
});

describe("AutomatedRemindersCard", () => {
  it("states only the two scheduled facts, with no last-sent data and no links", () => {
    const html = renderToStaticMarkup(<AutomatedRemindersCard />);
    expect(count(html, 'aria-label="Automated reminders"')).toBe(1);
    expect(html).toContain("Members get an expiry email every Monday at 08:00 (Vietnam time).");
    expect(html).toContain("The monthly report goes out on the 1st of each month.");
    expect(html).not.toContain("Last sent");
    expect(html).not.toContain("Preview");
    expect(html).not.toContain("next on");
    expect(html).not.toContain("<a ");
  });
});

describe("TeamScopeFilter", () => {
  it("filters by team only: no period selector and no second download link", () => {
    const html = renderToStaticMarkup(
      <TeamScopeFilter teams={[{ name: "Team Cloud", memberCount: 2 }]} selectedTeam={null} onSelectTeam={() => {}} />,
    );
    expect(html).toContain('aria-label="Filter by team scope"');
    expect(html).toContain("All teams");
    expect(html).toContain("Team Cloud");
    for (const gone of [">Month<", ">Quarter<", ">Year<", "Download report", "/api/export"]) {
      expect(html).not.toContain(gone);
    }
    // Member counts are shown once, in Allocated scope.
    expect(html).not.toContain("(2)");
  });
});
