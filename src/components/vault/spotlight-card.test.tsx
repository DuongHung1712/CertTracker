// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpotlightCard } from "./spotlight-card";

describe("SpotlightCard (backwards-compatibility module)", () => {
  afterEach(() => {
    cleanup();
  });

  it("exports SpotlightCard cleanly without mouse-tracking or gradient slop", () => {
    render(
      <SpotlightCard data-testid="spotlight-card" isVerified>
        <span>Compatible Credential Card</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("spotlight-card");
    expect(card).toBeDefined();
    expect(card.textContent).toContain("Compatible Credential Card");
    expect(card.className).toContain("vault-card");
    expect(card.className).toContain("vault-verified");
    expect(card.getAttribute("data-verified")).toBe("true");
  });
});
