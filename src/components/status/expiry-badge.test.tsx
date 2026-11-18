import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExpiryBadge } from "@/components/status/expiry-badge";
import { TooltipProvider } from "@/components/ui/tooltip";

const html = (counted?: boolean) =>
  renderToStaticMarkup(
    <TooltipProvider>
      <ExpiryBadge status="No Expiry" daysToExpiry={null} expiryDate={null} kind="completion" counted={counted} />
    </TooltipProvider>,
  );

describe("ExpiryBadge live dot (Credential Vault)", () => {
  it("shows the live dot on a counted credential", () => {
    expect(html()).toContain("vault-live-dot");
  });

  it("has no live dot on an item that waits for approval, was returned or was renewed", () => {
    expect(html(false)).not.toContain("vault-live-dot");
  });
});
