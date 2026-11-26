// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StyleProvider, type ThemeStyle } from "@/components/style-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StyleToggle } from "./style-toggle";

function renderWithProviders(ui: React.ReactNode, defaultStyle: ThemeStyle = "classic") {
  return render(
    <TooltipProvider>
      <StyleProvider defaultStyle={defaultStyle}>{ui}</StyleProvider>
    </TooltipProvider>,
  );
}

describe("StyleToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  it("renders with classic style by default and provides accessible name and shortcut hint", () => {
    renderWithProviders(<StyleToggle />);

    const button = screen.getByRole("button", {
      name: /Switch visual style to Credential Vault \(currently Classic Swiss\)/i,
    });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Classic");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("cycles visual style from classic to vault to nordic and back on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StyleToggle />);

    const button = screen.getByRole("button");

    // Click 1: classic -> vault
    await user.click(button);
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
    expect(button.textContent).toContain("Vault");
    expect(
      screen.getByRole("button", {
        name: /Switch visual style to Nordic Heritage \(currently Credential Vault\)/i,
      }),
    ).toBeDefined();

    // Click 2: vault -> nordic
    await user.click(button);
    expect(document.documentElement.getAttribute("data-style")).toBe("nordic");
    expect(button.textContent).toContain("Nordic");
    expect(
      screen.getByRole("button", {
        name: /Switch visual style to Classic Swiss \(currently Nordic Heritage\)/i,
      }),
    ).toBeDefined();

    // Click 3: nordic -> classic
    await user.click(button);
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
    expect(button.textContent).toContain("Classic");
    expect(
      screen.getByRole("button", {
        name: /Switch visual style to Credential Vault \(currently Classic Swiss\)/i,
      }),
    ).toBeDefined();
  });

  it("renders with vault style when defaultStyle is vault", () => {
    renderWithProviders(<StyleToggle />, "vault");

    const button = screen.getByRole("button", {
      name: /Switch visual style to Nordic Heritage \(currently Credential Vault\)/i,
    });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
  });

  it("renders with nordic style when defaultStyle is nordic", () => {
    renderWithProviders(<StyleToggle />, "nordic");

    const button = screen.getByRole("button", {
      name: /Switch visual style to Classic Swiss \(currently Nordic Heritage\)/i,
    });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Nordic");
    expect(document.documentElement.getAttribute("data-style")).toBe("nordic");
  });

  it("cycles styles on Alt+V keyboard shortcut", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StyleToggle />);

    expect(document.documentElement.getAttribute("data-style")).toBe("classic");

    // Fire Alt+V -> vault
    await user.keyboard("{Alt>}v{/Alt}");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");

    // Fire Alt+V -> nordic
    await user.keyboard("{Alt>}v{/Alt}");
    expect(document.documentElement.getAttribute("data-style")).toBe("nordic");

    // Fire Alt+V -> classic
    await user.keyboard("{Alt>}v{/Alt}");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("exposes correct visual style names and target styles in accessible name for all 3 styles (WCAG 2.5.3)", () => {
    document.documentElement.removeAttribute("data-style");
    const { unmount } = renderWithProviders(<StyleToggle />, "classic");
    expect(
      screen.getByRole("button", {
        name: "Classic Switch visual style to Credential Vault (currently Classic Swiss). Shortcut: Alt+V",
      }),
    ).toBeDefined();
    unmount();

    document.documentElement.removeAttribute("data-style");
    const { unmount: unmountVault } = renderWithProviders(<StyleToggle />, "vault");
    expect(
      screen.getByRole("button", {
        name: "Vault Switch visual style to Nordic Heritage (currently Credential Vault). Shortcut: Alt+V",
      }),
    ).toBeDefined();
    unmountVault();

    document.documentElement.removeAttribute("data-style");
    renderWithProviders(<StyleToggle />, "nordic");
    expect(
      screen.getByRole("button", {
        name: "Nordic Switch visual style to Classic Swiss (currently Nordic Heritage). Shortcut: Alt+V",
      }),
    ).toBeDefined();
  });
});
