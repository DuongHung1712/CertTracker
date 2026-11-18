// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UserMenu } from "./user-menu";
import { StyleProvider } from "@/components/style-provider";
import { ThemeProvider } from "@/components/theme-provider";

vi.mock("@/features/auth/actions", () => ({
  signOut: vi.fn(),
}));

function setupMatchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderUserMenu(email = "test@example.com", role: "admin" | "manager" | "member" = "admin") {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system">
      <StyleProvider defaultStyle="classic">
        <UserMenu email={email} role={role} />
      </StyleProvider>
    </ThemeProvider>,
  );
}

describe("UserMenu Visual Style & Theme Switcher", () => {
  beforeEach(() => {
    setupMatchMedia();
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.removeAttribute("data-style");
  });

  it("renders trigger with email and role badge", () => {
    renderUserMenu("admin@certtracker.vn", "admin");
    expect(screen.getByText("admin@certtracker.vn")).toBeDefined();
    expect(screen.getByText("Admin")).toBeDefined();
  });

  it("opens menu and displays Theme and Visual Style options", () => {
    renderUserMenu("staff@certtracker.vn", "member");
    const trigger = screen.getByRole("button", { name: /Account:/i });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(screen.getByText("Theme")).toBeDefined();
    expect(screen.getByText("Visual Style")).toBeDefined();
    expect(screen.getByText("Profile")).toBeDefined();
    expect(screen.getByText("Sign out")).toBeDefined();
  });

  it("exposes only Classic Swiss and Credential Vault visual styles in Visual Style submenu", () => {
    renderUserMenu("admin@certtracker.vn", "admin");
    const trigger = screen.getByRole("button", { name: /Account:/i });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const styleTrigger = screen.getByText("Visual Style");
    fireEvent.keyDown(styleTrigger, { key: "ArrowRight" });

    // Verify only the 2 supported styles exist
    expect(screen.getByText("Classic Swiss")).toBeDefined();
    expect(screen.getByText("Credential Vault")).toBeDefined();

    // Verify obsolete exploratory styles are completely gone from the DOM
    expect(screen.queryByText("Aurora Glass")).toBeNull();
    expect(screen.queryByText("Modern Tactile 2.0")).toBeNull();
  });

  it("switches visual style to Credential Vault on selecting the vault option", () => {
    renderUserMenu("admin@certtracker.vn", "admin");
    const trigger = screen.getByRole("button", { name: /Account:/i });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const styleTrigger = screen.getByText("Visual Style");
    fireEvent.keyDown(styleTrigger, { key: "ArrowRight" });

    const vaultOption = screen.getByText("Credential Vault");
    fireEvent.click(vaultOption);

    expect(document.documentElement.getAttribute("data-style")).toBe("vault");
  });
});
