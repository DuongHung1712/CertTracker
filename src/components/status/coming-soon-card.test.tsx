import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ComingSoonCard } from "./coming-soon-card";

describe("ComingSoonCard", () => {
  it("renders title, description and coming soon chip with neutral styling", () => {
    const html = renderToStaticMarkup(
      <ComingSoonCard
        title="My skills matrix"
        description="Map your skills against team standards."
      />,
    );

    expect(html).toContain('aria-label="My skills matrix (Coming soon)"');
    expect(html).toContain("My skills matrix");
    expect(html).toContain("Map your skills against team standards.");
    expect(html).toContain("Coming soon");
    expect(html).toContain("border-dashed");
  });

  it("renders disabled children controls without leaking interactive actions", () => {
    const html = renderToStaticMarkup(
      <ComingSoonCard
        title="Compliance copilot"
        description="Ask AI about policies."
      >
        <input disabled aria-disabled="true" placeholder="Ask AI..." />
        <button type="button" disabled aria-disabled="true">
          Question chip
        </button>
      </ComingSoonCard>,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('placeholder="Ask AI..."');
    expect(html).toContain("Question chip");
  });
});
