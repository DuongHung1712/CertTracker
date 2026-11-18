// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StyleProvider } from "@/components/style-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StyleToggle } from "./style-toggle";

function renderWithProviders(ui: React.ReactNode, defaultStyle: "classic" | "vault" = "classic") {
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

  it("toggles visual style from classic to vault and back on click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StyleToggle />);

    const button = screen.getByRole("button");

    // Click 1: classic -> vault
    await user.click(button);
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
    expect(button.textContent).toContain("Vault");
    expect(
      screen.getByRole("button", {
        name: /Switch visual style to Classic Swiss \(currently Credential Vault\)/i,
      }),
    ).toBeDefined();

    // Click 2: vault -> classic
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
      name: /Switch visual style to Classic Swiss \(currently Credential Vault\)/i,
    });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Vault");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
  });

  it("toggles style on Alt+V keyboard shortcut", async () => {
    const user = userEvent.setup();
    renderWithProviders(<StyleToggle />);

    expect(document.documentElement.getAttribute("data-style")).toBe("classic");

    // Fire Alt+V
    await user.keyboard("{Alt>}v{/Alt}");
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");

    // Fire Alt+V again
    await user.keyboard("{Alt>}v{/Alt}");
    expect(document.documentElement.getAttribute("data-style")).toBe("classic");
  });

  it("gracefully functions when rendered without StyleProvider", async () => {
    const user = userEvent.setup();
    render(<StyleToggle />);

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Classic");

    await user.click(button);
    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
    expect(button.textContent).toContain("Vault");
  });

  it("updates fallbackStyle in fallback mode when an external style change event occurs", async () => {
    render(<StyleToggle />);
    const button = screen.getByRole("button");
    expect(button.textContent).toContain("Classic");

    // Dispatch external change to vault
    act(() => {
      window.dispatchEvent(new CustomEvent("certtracker-style-change", { detail: "vault" }));
    });
    expect(button.textContent).toContain("Vault");

    // Dispatch external change back to classic
    act(() => {
      window.dispatchEvent(new CustomEvent("certtracker-style-change", { detail: "classic" }));
    });
    expect(button.textContent).toContain("Classic");
  });
});
