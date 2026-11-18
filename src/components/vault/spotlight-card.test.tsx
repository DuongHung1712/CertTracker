// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SpotlightCard } from "./spotlight-card";

describe("SpotlightCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children cleanly with default spotlight class", () => {
    render(
      <SpotlightCard data-testid="card">
        <span>Verified Credential Content</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("card");
    expect(card).toBeDefined();
    expect(card.textContent).toContain("Verified Credential Content");
    expect(card.className).toContain("vault-spotlight");
    expect(card.className).not.toContain("vault-hologram");
    expect(card.className).not.toContain("vault-verified");
    expect(card.querySelector(".vault-border-beam")).toBeNull();
  });

  it("renders hologram sheen, border beam, and verification pulse when enabled", () => {
    render(
      <SpotlightCard
        data-testid="card"
        hasHologram
        hasBorderBeam
        isVerified
      >
        <span>Secure Credential</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("card");
    expect(card.className).toContain("vault-hologram");
    expect(card.className).toContain("vault-verified");
    expect(card.getAttribute("data-verified")).toBe("true");
    expect(card.querySelector(".vault-border-beam")).not.toBeNull();
  });

  it("updates --mouse-x and --mouse-y CSS properties on pointer move", () => {
    render(
      <SpotlightCard data-testid="card" hasSpotlight>
        <span>Interactive Spotlight Content</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("card");
    // Mock getBoundingClientRect
    card.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        right: 400,
        bottom: 250,
        width: 300,
        height: 200,
        x: 100,
        y: 50,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.pointerMove(card, { clientX: 180, clientY: 120 });

    expect(card.style.getPropertyValue("--mouse-x")).toBe("80px");
    expect(card.style.getPropertyValue("--mouse-y")).toBe("70px");
  });

  it("does not update CSS variables when hasSpotlight is false", () => {
    render(
      <SpotlightCard data-testid="card" hasSpotlight={false}>
        <span>Static Card</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("card");
    card.getBoundingClientRect = () =>
      ({
        left: 50,
        top: 50,
        right: 250,
        bottom: 250,
        width: 200,
        height: 200,
        x: 50,
        y: 50,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.pointerMove(card, { clientX: 100, clientY: 100 });

    expect(card.style.getPropertyValue("--mouse-x")).toBe("");
    expect(card.style.getPropertyValue("--mouse-y")).toBe("");
    expect(card.className).not.toContain("vault-spotlight");
  });
});
