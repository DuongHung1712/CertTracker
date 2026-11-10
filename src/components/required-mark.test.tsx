import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequiredMark } from "@/components/required-mark";

// R12: the red star after a required field's label; screen readers get `aria-required` on the control instead.
describe("RequiredMark", () => {
  it("renders a red star hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<RequiredMark />);
    const element = html.match(/^<(\w+)([^>]*)>\*<\/\1>$/);
    expect(element, `unexpected markup: ${html}`).not.toBeNull();
    expect(element![2]).toContain('aria-hidden="true"');
    expect(element![2]).toMatch(/class="[^"]*\btext-destructive\b[^"]*"/);
  });
});
