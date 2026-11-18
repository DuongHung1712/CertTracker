// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "./topbar";
import { StyleProvider } from "@/components/style-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

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

describe("Topbar", () => {
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

  it("renders navigation breadcrumb, notifications menu, StyleToggle, and UserMenu", () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <StyleProvider defaultStyle="classic">
          <TooltipProvider>
            <SidebarProvider defaultOpen={true}>
              <Topbar email="admin@certtracker.vn" role="admin" />
            </SidebarProvider>
          </TooltipProvider>
        </StyleProvider>
      </ThemeProvider>,
    );

    // Breadcrumb
    expect(screen.getByText("Dashboard")).toBeDefined();

    // StyleToggle button is mounted
    const styleToggle = screen.getByRole("button", {
      name: /Switch visual style/i,
    });
    expect(styleToggle).toBeDefined();

    // UserMenu trigger is mounted
    const userMenu = screen.getByRole("button", {
      name: /Account:/i,
    });
    expect(userMenu).toBeDefined();
    expect(userMenu.textContent).toContain("admin@certtracker.vn");
  });
});
