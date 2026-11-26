import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagerAttentionList } from "@/features/dashboard/components/manager/manager-attention-list";
import { ManagerTeamTable } from "@/features/dashboard/components/manager/manager-team-table";
import { TeamScopeFilter } from "@/features/dashboard/components/manager/team-scope-filter";
import { SummaryTile } from "@/features/dashboard/components/summary-tile";
import { getTeamReadinessLeague } from "@/features/dashboard/manager-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const MEMBERS = [
  { id: "m1", fullName: "Nguyễn Văn An", teamName: "Team Cloud" },
  { id: "m2", fullName: "Lê Minh Châu", teamName: "Team AI" },
];

describe("ManagerAttentionList", () => {
  it("is one named region and says plainly when there is nothing to chase", () => {
    const html = renderToStaticMarkup(
      <ManagerAttentionList records={[doneRecord(200, { id: "ok", memberId: "m1", memberName: "Nguyễn Văn An" }), doneRecord(200, { id: "ok2", memberId: "m2", memberName: "Lê Minh Châu" })]} members={MEMBERS} showTeam={false} />,
    );
    expect(html.split('aria-label="Needs attention"')).toHaveLength(2);
    expect(text(html)).toContain("Nothing to chase right now.");
    expect(text(html)).toContain("everyone has one");
  });

  it("puts expired first, then expiring, then people with no certificate; each row opens that person in Learning", () => {
    const html = renderToStaticMarkup(
      <ManagerAttentionList
        records={[
          doneRecord(20, { id: "soon", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "AWS" }),
          doneRecord(-4, { id: "old", memberId: "m1", memberName: "Nguyễn Văn An", certificateName: "CKA" }),
        ]}
        members={MEMBERS}
        showTeam={false}
      />,
    );
    const content = text(html);
    expect(content.indexOf("CKA")).toBeLessThan(content.indexOf("AWS"));
    expect(content.indexOf("AWS")).toBeLessThan(content.indexOf("Lê Minh Châu"));
    expect(content).toContain("Expired 4 days ago");
    expect(content).toContain("20 days left");
    expect(content).toContain("No certificate yet");
    expect(html).toContain('href="/records?search=Nguy%E1%BB%85n%20V%C4%83n%20An%20M001%20CKA"');
  });

  it("says the learning items could not be loaded instead of an all clear", () => {
    const html = renderToStaticMarkup(<ManagerAttentionList records={[]} members={[]} showTeam={false} incomplete />);
    expect(text(html)).toContain("Learning items could not be loaded");
    expect(text(html)).not.toContain("Nothing to chase");
    expect(text(html)).not.toContain("everyone has one");
  });

  it("names the team on a row only when the manager looks after several", () => {
    const records = [doneRecord(-1, { id: "x", memberId: "m1", memberName: "Nguyễn Văn An", teamName: "Team Cloud" })];
    expect(text(renderToStaticMarkup(<ManagerAttentionList records={records} members={[MEMBERS[0]]} showTeam />))).toContain("Team Cloud");
    expect(text(renderToStaticMarkup(<ManagerAttentionList records={records} members={[MEMBERS[0]]} showTeam={false} />))).not.toContain("Team Cloud");
  });

  it("shows six rows, says how many there are in all and points to Learning", () => {
    const records = Array.from({ length: 9 }, (_, i) => doneRecord(-(i + 1), { id: `e${i}`, memberId: "m1", memberName: "Nguyễn Văn An", certificateName: `Cert ${i}` }));
    const html = renderToStaticMarkup(<ManagerAttentionList records={records} members={[MEMBERS[0]]} showTeam={false} />);
    expect(html.match(/<li\b/g)).toHaveLength(6);
    expect(text(html)).toContain("Showing 6 of 9.");
    expect(html).toMatch(/<a\b[^>]*href="\/records"[^>]*>\s*Open Learning/);

    const scoped = renderToStaticMarkup(<ManagerAttentionList records={records} members={[MEMBERS[0]]} showTeam={false} selectedTeam="Team Cloud" />);
    expect(scoped).toMatch(/<a\b[^>]*href="\/records\?team=Team%20Cloud"[^>]*>\s*Open Learning/);
  });

  it("does not list a planned exam that is more than 60 days away", () => {
    const far = makeRecord({ id: "far", memberId: "m1", memberName: "Nguyễn Văn An", status: "not_started", plannedExamDate: "2099-01-01", expiryStatus: "N/A", daysToExpiry: null });
    expect(text(renderToStaticMarkup(<ManagerAttentionList records={[far]} members={[]} showTeam={false} />))).not.toContain("Exam on");
  });
});

describe("ManagerTeamTable", () => {
  const rows = getTeamReadinessLeague(MEMBERS, [
    doneRecord(100, { id: "a", memberId: "m1", memberName: "Nguyễn Văn An" }),
    doneRecord(-9, { id: "b", memberId: "m2", memberName: "Lê Minh Châu" }),
  ]);

  it("shows each person with their counts and one plain status", () => {
    const content = text(renderToStaticMarkup(<ManagerTeamTable rows={rows} showTeam={false} />));
    expect(content).toContain("Nguyễn Văn An 1 0 0 Ready");
    expect(content).toContain("Lê Minh Châu 0 0 1 Needs renewal");
  });

  it("says No certificate yet for someone with none", () => {
    const only = getTeamReadinessLeague([MEMBERS[0]], []);
    expect(text(renderToStaticMarkup(<ManagerTeamTable rows={only} showTeam={false} />))).toContain("No certificate yet");
  });

  it("has a Team column only when asked, and links each name to their rows in Learning", () => {
    expect(text(renderToStaticMarkup(<ManagerTeamTable rows={rows} showTeam={false} />))).not.toContain("Team Cloud");
    const withTeam = renderToStaticMarkup(<ManagerTeamTable rows={rows} showTeam />);
    expect(text(withTeam)).toContain("Team Cloud");
    expect(withTeam).toContain('href="/records?search=L%C3%AA%20Minh%20Ch%C3%A2u"');
  });

  it("says so when there are no members", () => {
    expect(text(renderToStaticMarkup(<ManagerTeamTable rows={[]} showTeam={false} />))).toContain("No members in this team yet.");
  });
});

describe("TeamScopeFilter", () => {
  it("marks the selected team with aria-pressed, shows member counts and includes focus-visible ring", () => {
    const html = renderToStaticMarkup(<TeamScopeFilter teams={[{ name: "Team Cloud", memberCount: 2 }, { name: "Team AI", memberCount: 1 }]} selectedTeam="Team AI" onSelectTeam={() => {}} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(text(html)).toContain("Team Cloud (2)");
    expect(text(html)).toContain("Team AI (1)");
    expect(html).toContain("focus-visible:ring-2");
  });
});

describe("SummaryTile", () => {
  it("is a figure with its label, one explaining line and a footer", () => {
    const html = renderToStaticMarkup(<SummaryTile label="Expired" value={3} summary="Past the expiry date" footer="Listed under Needs attention" tone="danger" />);
    expect(text(html)).toBe("Expired 3 Past the expiry date Listed under Needs attention");
    expect(html).toContain("border-[var(--status-expired-border)]");
    expect(html).toContain("text-status-expired-fg");
  });

  it("keeps the figure in the normal text colour when nothing is wrong", () => {
    const html = renderToStaticMarkup(<SummaryTile label="Expired" value={0} summary="Nothing has expired" footer="All up to date" />);
    expect(html).not.toContain("text-status-expired-fg");
  });
});
