import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ApprovalsQueueComingSoon,
  AskAboutMyTeamComingSoon,
  GoalsComingSoon,
  ManagerTabStrip,
  RiskAlertsComingSoon,
  SkillsComingSoon,
} from "@/features/dashboard/components/manager/manager-coming-soon-stack";
import { ManagerKpiCards } from "@/features/dashboard/components/manager/manager-kpi-cards";
import { NeedsAttentionFeed } from "@/features/dashboard/components/manager/needs-attention-feed";
import { NextToExpireTable } from "@/features/dashboard/components/manager/next-to-expire-table";
import { PlannedExamsList } from "@/features/dashboard/components/manager/planned-exams-list";
import { TeamReadinessLeague } from "@/features/dashboard/components/manager/team-readiness-league";
import { calculateManagerKpis } from "@/features/dashboard/manager-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";

describe("ManagerKpiCards", () => {
  it("renders 4 KPI tiles with label in dt and value in dd", () => {
    const records = [
      doneRecord(25), // valid, expiring 60, expiring 30
      makeRecord({ status: "not_started" }),
    ];
    const kpis = calculateManagerKpis(records);
    const html = renderToStaticMarkup(<ManagerKpiCards kpis={kpis} />);

    // Tile 1: Team readiness
    expect(html).toContain("Team readiness");
    expect(html).toContain("100%");
    expect(html).toContain('aria-label="Team readiness ring: 100% valid certificates"');

    // Tile 2: Expiring within 60 days
    expect(html).toContain("Expiring within 60 days");
    expect(html).toContain("1");

    // Tile 3: Expired (positive empty state when 0)
    expect(html).toContain("Expired");
    expect(html).toContain("No expired certificates");

    // Tile 4: Waiting for approval (Coming soon)
    expect(html).toContain("Waiting for approval");
    expect(html).toContain("Approvals workflow not available yet.");
  });
});

describe("NextToExpireTable", () => {
  it("renders positive empty state when no certificates are expiring within 60 days", () => {
    const records = [doneRecord(120), doneRecord(-5)];
    const html = renderToStaticMarkup(<NextToExpireTable records={records} />);
    expect(html).toContain("No upcoming expirations");
    expect(html).toContain("All completed certificates have more than 60 days of validity remaining.");
  });

  it("renders upcoming certificates with table headers, status badge and view link", () => {
    const records = [
      doneRecord(25, { memberName: "Nguyễn Văn An", courseName: "AWS SAA" }),
    ];
    const html = renderToStaticMarkup(<NextToExpireTable records={records} />);
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("AWS SAA");
    expect(html).toContain('href="/records?search=Nguy%E1%BB%85n%20V%C4%83n%20An"');
  });
});

describe("TeamReadinessLeague", () => {
  it("renders empty state when manager has no members", () => {
    const html = renderToStaticMarkup(<TeamReadinessLeague members={[]} records={[]} />);
    expect(html).toContain("No members in your teams yet.");
  });

  it("renders league list with member status breakdown and segmented bar", () => {
    const members = [{ id: "m1", fullName: "Nguyễn Văn An", teamName: "Team Cloud" }];
    const records = [doneRecord(25, { memberId: "m1" })];
    const html = renderToStaticMarkup(<TeamReadinessLeague members={members} records={records} />);
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("Team Cloud");
    expect(html).toContain("1 valid");
    expect(html).toContain('aria-label="Status breakdown for Nguyễn Văn An: 1 valid, 0 in progress, 0 expired, 0 not started"');
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
        courseName: "NVIDIA AI",
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
  it("renders positive empty state when nothing needs attention", () => {
    const html = renderToStaticMarkup(<NeedsAttentionFeed records={[doneRecord(100)]} />);
    expect(html).toContain("Nothing needs attention");
  });

  it("renders expired and urgent attention items", () => {
    const records = [
      doneRecord(-5, { memberName: "Minh", courseName: "PMP" }),
      doneRecord(10, { memberName: "An", courseName: "AWS" }),
    ];
    const html = renderToStaticMarkup(<NeedsAttentionFeed records={records} />);
    expect(html).toContain("Expired certificate");
    expect(html).toContain("Resolve");
    expect(html).toContain("Expires within 30 days");
    expect(html).toContain("View");
  });
});

describe("ManagerComingSoonStack & TabStrip", () => {
  it("renders all coming soon cards with disabled controls", () => {
    const html = renderToStaticMarkup(
      <div>
        <ManagerTabStrip />
        <ApprovalsQueueComingSoon />
        <GoalsComingSoon />
        <SkillsComingSoon />
        <AskAboutMyTeamComingSoon />
        <RiskAlertsComingSoon />
      </div>,
    );

    // Tab strip: Overview active, others disabled
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("Overview");
    expect(html).toContain("Approvals");
    expect(html).toContain("Goals");
    expect(html).toContain("Skills");

    // Controls inside coming soon cards must be disabled
    expect(html).toContain("Review queued evidence");
    expect(html).toContain("Set quarterly goal");
    expect(html).toContain("View skill matrix");
    expect(html).toContain("Cloud certification coverage?");
    expect(html).toContain("View risk assessment");
    expect(html).toContain("disabled");
    expect(html).toContain("Not available yet.");
  });
});
