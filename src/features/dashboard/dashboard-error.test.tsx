import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Explorer } from "@/features/dashboard/components/explorer";

describe("dashboard error isolation", () => {
  const tabs = [
    {
      id: "team",
      label: "By team",
      groupLabel: "Team",
      result: { ok: false as const, error: "Database timeout" },
    },
    {
      id: "provider",
      label: "By provider",
      groupLabel: "Provider",
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

it("renders SectionError for a failed tab and never shows 'No data yet'", () => {
    const html = renderToStaticMarkup(<Explorer tabs={tabs} defaultTab="team" />);

    // Must show SectionError for the failed tab
    expect(html).toContain('Could not load &quot;By team&quot;');
    expect(html).toContain("Reload the page to try again.");

    // Must never show empty state "No data yet" when the query failed
    expect(html).not.toContain("No data yet");
  });

  it("renders a healthy tab's content when another tab failed", () => {
    const html = renderToStaticMarkup(<Explorer tabs={tabs} defaultTab="provider" />);

    expect(html).toContain("AWS");
    expect(html).not.toContain("Could not load");
    // The failed tab is still offered; it has no count badge because it has no data.
    expect(html).toContain("By team");
  });

  // The hero-card chart error is tested through the real page in src/app/(app)/dashboard/page.test.tsx.
});
