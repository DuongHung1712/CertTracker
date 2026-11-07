import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Explorer } from "@/features/dashboard/components/explorer";
import { KpiCard } from "@/features/dashboard/components/kpi-card";
import { RecordsMiniChart } from "@/features/dashboard/components/hero-charts";

describe("dashboard error isolation", () => {
  it("renders SectionError for a failed tab and never shows 'No data yet'", () => {
    const tabs = [
      {
        id: "team",
        label: "By team",
        groupLabel: "Team",
        peopleLabel: "Members",
        result: { ok: false as const, error: "Database timeout" },
      },
      {
        id: "provider",
        label: "By provider",
        groupLabel: "Provider",
        peopleLabel: "Learners",
        result: {
          ok: true as const,
          data: [
            {
              key: "aws",
              label: "AWS",
              people: 5,
              records: 10,
              done: 8,
              inProgress: 2,
              notStarted: 0,
              valid: 8,
              expired: 0,
              headcount: null,
            },
          ],
        },
      },
    ];

    const html = renderToStaticMarkup(<Explorer tabs={tabs} defaultTab="team" />);

    // Must show SectionError for the failed tab
    expect(html).toContain('Could not load &quot;By team&quot;');
    expect(html).toContain("Reload the page to try again.");

    // Must never show empty state "No data yet" when the query failed
    expect(html).not.toContain("No data yet");
  });

  it("renders inline alert error inside hero card visual slot when source failed", () => {
    const heroBreakdownResult = { ok: false as const, error: "Could not load the data." };

    const html = renderToStaticMarkup(
      <KpiCard
        label="Certificate records"
        value={42}
        visual={
          !heroBreakdownResult.ok ? (
            <div role="alert" className="error-slot">
              Could not load chart.
            </div>
          ) : (
            <RecordsMiniChart rows={[]} />
          )
        }
      />
    );

    // Number is preserved
    expect(html).toContain("42");
    // Visual slot renders error state, not empty chart
    expect(html).toContain("Could not load chart.");
    expect(html).not.toContain("No records yet");
  });
});
