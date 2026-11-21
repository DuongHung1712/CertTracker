import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DetailPanel } from "@/features/dashboard/components/explorer/detail-panel";
import { MasterList } from "@/features/dashboard/components/explorer/master-list";
import {
  copySummaryText,
  MIN_RECORDS_FILTER_LABELS,
  STATUS_FILTER_LABELS,
} from "@/features/dashboard/components/explorer/types";
import { ExpiringGaugeMiniChart, RecordsMiniChart } from "@/features/dashboard/components/hero-charts";
import { StatusBar } from "@/features/dashboard/components/status-bar";
import { MemberAttentionBanner } from "@/features/dashboard/components/member/member-attention-banner";
import { MemberCertificatesList } from "@/features/dashboard/components/member/member-certificates-list";
import { MemberKpiCards } from "@/features/dashboard/components/member/member-kpi-cards";
import { calculateMemberKpis } from "@/features/dashboard/member-metrics";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";
import type { RecordRow } from "@/features/records/queries";

// Copy WP6 (ux-copy-audit.md §1, §2, §4): plain terms and counted nouns through `pluralize` / `daysLeftLabel`.

// The sheet stays closed here; stub it so its server-action imports stay out of the render.
vi.mock("@/features/records/components/record-sheet", () => ({ RecordSheet: () => null }));

/** Visible text: tags dropped, entities decoded, whitespace collapsed. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const PLURAL_BUGS = /\b1 (days|records|members|certificates|certifications)\b/;

function row(partial: Partial<BreakdownRow>): BreakdownRow {
  return {
    key: "k1", label: "Team Cloud", headcount: null, people: 1, records: 1,
    done: 1, inProgress: 0, notStarted: 0, valid: 1, expired: 0, ...partial,
  };
}

describe("[copy] member KPI cards", () => {
  const render = (records: RecordRow[]) => text(renderToStaticMarkup(<MemberKpiCards kpis={calculateMemberKpis(records)} />));

  it("uses the agreed tile labels", () => {
    const raw = renderToStaticMarkup(<MemberKpiCards kpis={calculateMemberKpis([doneRecord(45, { id: "a" })])} />);
    // The e2e tile lookup matches the `dt` text exactly (the label is the tile's link).
    for (const label of ["Valid", "Needs action", "In progress", "Up next"]) {
      expect(raw, label).toMatch(new RegExp(`<dt[^>]*>.*?>\\s*${label}\\s*</a></dt>`, "s"));
    }
    expect(text(raw)).not.toMatch(/Recorded certificates|Recorded credentials|Compliant|≤|active study goals| exp |\d+ study\b/i);
  });

  it("says plainly that nothing needs renewing", () => {
    const html = render([doneRecord(120)]);
    expect(html).toContain("Nothing due in 60 days");
    expect(html).toContain("All up to date");
    expect(html).not.toMatch(/Audit compliance|registry violations/i);
  });

  it("names the next exam to expire and counts its days with daysLeftLabel", () => {
    const one = render([doneRecord(1)]);
    expect(one).toContain("Next: AWS Solutions Architect Associate");
    expect(one).toContain("1 day left");
    const today = render([doneRecord(0)]);
    expect(today).toContain("Expires today");
    expect(today).not.toContain("0 days left");
  });

  it("counts expired exams with the right noun", () => {
    expect(render([doneRecord(-3, { id: "a" })])).toContain("1 expired exam");
    expect(render([doneRecord(-3, { id: "a" }), doneRecord(-9, { id: "b" })])).toContain("2 expired exams");
  });
});

describe("[copy] member attention banner", () => {
  const render = (days: number) =>
    text(renderToStaticMarkup(<MemberAttentionBanner attention={{ record: doneRecord(days), urgency: "urgent" }} onUploadProof={() => {}} />));

  it("counts one day in the singular", () => {
    expect(render(1)).toContain("1 day left");
    expect(render(1)).not.toMatch(PLURAL_BUGS);
  });

  it("says today on the expiry day", () => {
    expect(render(0)).toContain("Expires today");
    expect(render(0)).not.toContain("0 days left");
  });
});

describe("[copy] member certificate list", () => {
  const render = (records: RecordRow[]) =>
    text(renderToStaticMarkup(
      <MemberCertificatesList
        fullName="Lê Minh Châu"
        records={records}
        certificateOptions={[]}
        studyCourses={[]}
        memberId="m1"
        sheetOpen={false}
        onSheetOpenChange={() => {}}
        editingRecord={null}
        onEditRecord={() => {}}
      />,
    ));

  const studying = makeRecord({
    status: "in_progress", progress: 40, plannedExamDate: "2026-12-01",
    issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A",
  });

  it("counts one exam certificate in the singular, apart from course completions, and drops Registered Records", () => {
    const html = render([studying]);
    expect(html).toContain("My learning");
    expect(html).toContain("1 exam certificate, 0 course completions");
    expect(html).not.toMatch(PLURAL_BUGS);
    expect(html).not.toMatch(/Registered Records|certifications registered/);
  });

  it("names the expiring tab with the aggregate wording", () => {
    expect(render([doneRecord(45)])).toContain("Expiring within 60 days (1)");
  });
});

describe("[copy] explorer master list", () => {
  const render = (rows: BreakdownRow[], groupLabel = "Team") =>
    text(renderToStaticMarkup(
      <MasterList rows={rows} activeKey={null} onSelectKey={() => {}} groupLabel={groupLabel} tabLabel="By team" onClearFilters={() => {}} />,
    ));

  it("team tab: members in the team, then members with certificates, then certificates", () => {
    const one = render([row({ headcount: 1, people: 1, records: 1 })]);
    expect(one).toContain("1 member · 1 with learning items");
    expect(one).toContain("1 learning item");
    expect(one).not.toMatch(PLURAL_BUGS);
    expect(one).not.toContain("headcount");
    expect(render([row({ headcount: 3, people: 2, records: 5 })])).toContain("3 members · 2 with learning items");
  });

  it("other tabs count members only", () => {
    const one = render([row({ headcount: null, people: 1 })], "Course");
    expect(one).toContain("1 member");
    expect(one).not.toMatch(PLURAL_BUGS);
    expect(render([row({ headcount: null, people: 4, records: 7 })], "Course")).toContain("4 members");
  });

  it("calls the count column Total and never says records", () => {
    const html = render([row({ records: 2 })]);
    expect(html).toContain("Total");
    expect(html).toContain("2 learning items");
    expect(html).not.toMatch(/\brecords?\b/i);
  });

  it("explains an empty filter result", () => {
    expect(render([])).toContain("No groups match these filters.");
  });
});

describe("[copy] explorer detail panel", () => {
  const render = (r: BreakdownRow) =>
    text(renderToStaticMarkup(<DetailPanel selectedRow={r} groupLabel="Team" peopleLabel="Members" />));

  it("counts certificates with pluralize and links to Certificates", () => {
    const html = render(row({ records: 1 }));
    expect(html).toContain("Total: 1 learning item");
    expect(html).not.toMatch(PLURAL_BUGS);
    expect(html).toContain("View learning");
    expect(html).not.toMatch(/\brecords?\b/i);
    expect(render(row({ records: 3, done: 2 }))).toContain("Total: 3 learning items");
  });

  it("words a certificate group by its members in the header, the footer and the copied text", () => {
    const certificate = row({ label: "AWS SAA", people: 3, records: 3, done: 1, inProgress: 1, valid: 1, expired: 0, headcount: null });
    const html = text(renderToStaticMarkup(<DetailPanel selectedRow={certificate} groupLabel="Certificate" peopleLabel="Members" />));
    expect(html).toContain("Members: 3");
    expect(html).not.toContain("Certificates: 3");
    expect(html).toContain("Total: 3 members");
    expect(html).not.toMatch(/records?/i);
    expect(copySummaryText(certificate, "Certificate")).toBe(
      "AWS SAA: 3 members, 33% done rate (1 completed, 1 in progress, 1 valid, 0 expired).",
    );
  });

  it("copies a summary in plain terms", () => {
    expect(copySummaryText(row({ label: "AWS", records: 1, done: 1, inProgress: 0, valid: 1, expired: 0 }), "Provider")).toBe(
      "AWS: 1 learning item, 100% done rate (1 completed, 0 in progress, 1 valid, 0 expired).",
    );
    expect(copySummaryText(row({ label: "AWS", records: 4, done: 2, inProgress: 1, valid: 1, expired: 1 }), "Provider")).toBe(
      "AWS: 4 learning items, 50% done rate (2 completed, 1 in progress, 1 valid, 1 expired).",
    );
  });
});

describe("[copy] explorer filters", () => {
  it("labels the status filter by what the group contains", () => {
    expect(STATUS_FILTER_LABELS).toEqual({
      all: "Any status",
      has_expired: "With expired certificates",
      has_in_progress: "With items in progress",
      no_completed: "With no completed items",
    });
  });

  it("labels the size filter in learning items, without symbols", () => {
    expect(MIN_RECORDS_FILTER_LABELS).toEqual({
      "0": "Any number of learning items",
      "1": "1 or more learning items",
      "5": "5 or more learning items",
      "10": "10 or more learning items",
    });
  });
});

describe("[copy] hero expiring gauge", () => {
  it("counts one certificate in the singular", () => {
    const html = renderToStaticMarkup(<ExpiringGaugeMiniChart expiringCount={1} totalCompleted={4} />);
    expect(html).toContain("Expiring within 60 days: 1 certificate (");
    expect(text(html)).not.toMatch(PLURAL_BUGS);
  });

  it("keeps the thousands separator in counts", () => {
    const html = renderToStaticMarkup(<ExpiringGaugeMiniChart expiringCount={1250} totalCompleted={5000} />);
    expect(html).toContain("Expiring within 60 days: 1,250 certificates (");
  });
});

describe("[copy] hero charts: words the SVG draws", () => {
  // Recharts draws ticks and segment names only in a browser, so read the literals in the source.
  const source = readFileSync(join(process.cwd(), "src/features/dashboard/components/hero-charts.tsx"), "utf8");

  it("labels the longest valid bucket 61+ days, since 60 belongs to 31–60 days", () => {
    expect(source).toContain('"61+ days"');
    expect(source).not.toContain('"60+ days"');
  });

  it("names the rest of the gauge Other: it also holds expired certificates, so not Other valid", () => {
    expect(source).toContain('name: "Other",');
    expect(source).not.toContain("Other valid");
  });

  it("says No certificates yet when there is nothing to chart", () => {
    const html = text(renderToStaticMarkup(<RecordsMiniChart rows={[]} totalRecords={0} />));
    expect(html).toBe("No certificates yet");
  });
});

describe("[copy] status bar", () => {
  it("names an empty bar in certificates", () => {
    const html = renderToStaticMarkup(<StatusBar segments={[{ key: "a", label: "Valid", count: 0, color: "x" }]} />);
    expect(html).toContain('aria-label="No certificates"');
  });
});

describe("[copy] member dashboard subtitle", () => {
  it("greets warmly and encourages learning instead of audit wording", () => {
    const source = readFileSync(join(process.cwd(), "src/features/dashboard/load.ts"), "utf8");
    expect(source).toContain("Ready to plan your next certification milestone?");
    expect(source).not.toContain("${getGreeting(profile.fullName, now)} · Figures as of");
  });
});
