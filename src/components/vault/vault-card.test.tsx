// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VaultCard, SpotlightCard } from "./vault-card";

describe("VaultCard & SpotlightCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders children cleanly with vault-card styling and zero AI-slop artifacts", () => {
    render(
      <VaultCard data-testid="card">
        <span>Verified Credential Content</span>
      </VaultCard>,
    );

    const card = screen.getByTestId("card");
    expect(card).toBeDefined();
    expect(card.textContent).toContain("Verified Credential Content");
    expect(card.className).toContain("vault-card");
    expect(card.getAttribute("data-slot")).toBe("vault-card");
    expect(card.className).not.toContain("vault-verified");
    expect(card.getAttribute("data-verified")).toBeNull();
    // Confirms zero tacky leftover divs
    expect(card.querySelector(".vault-border-beam")).toBeNull();
    expect(card.querySelector(".vault-spotlight")).toBeNull();
  });

  it("applies solid verified credential border and data-verified attribute when isVerified is true", () => {
    render(
      <VaultCard data-testid="card" isVerified>
        <span>Secure CISSP Credential</span>
      </VaultCard>,
    );

    const card = screen.getByTestId("card");
    expect(card.className).toContain("vault-verified");
    expect(card.getAttribute("data-verified")).toBe("true");
  });

  it("SpotlightCard alias maintains backwards compatibility", () => {
    render(
      <SpotlightCard data-testid="card" isVerified>
        <span>Alias Content</span>
      </SpotlightCard>,
    );

    const card = screen.getByTestId("card");
    expect(card.className).toContain("vault-card");
    expect(card.className).toContain("vault-verified");
    expect(card.textContent).toContain("Alias Content");
  });

  it("passes arbitrary props and merges custom classNames", () => {
    render(
      <VaultCard data-testid="card" className="custom-vault-class" id="my-card">
        <span>Custom Card</span>
      </VaultCard>,
    );

    const card = screen.getByTestId("card");
    expect(card.className).toContain("custom-vault-class");
    expect(card.id).toBe("my-card");
  });
});
