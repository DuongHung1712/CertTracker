// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningTabs } from "@/features/learning/components/learning-tabs";

const replace = vi.fn();
let currentParams = new URLSearchParams("view=x&team=Alpha");
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/me", useSearchParams: () => currentParams }));

afterEach(() => {
  cleanup();
  replace.mockClear();
  currentParams = new URLSearchParams("view=x&team=Alpha");
});

describe("LearningTabs", () => {
  it("shows both counts, clears tab-specific params when switching, and keeps shared params", async () => {
    render(<LearningTabs initialTab="certificates" certificatesCount={2} learningCount={5} certificates={<p>certs</p>} learning={<p>journey</p>} />);
    expect(screen.getByRole("tab", { name: "Certificates (2)" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("certs")).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Learning (5)" }));
    expect(replace).toHaveBeenCalledWith("/me?team=Alpha&tab=learning", { scroll: false });
  });

  it("shows no number, not a false 0, on a tab whose list could not be loaded", () => {
    render(<LearningTabs initialTab="certificates" learningCount={5} certificates={<p>certs</p>} learning={<p>journey</p>} />);
    expect(screen.getByRole("tab", { name: "Certificates" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Learning (5)" })).toBeTruthy();
  });

  it("derives the active tab from ?tab= in searchParams", () => {
    currentParams = new URLSearchParams("tab=learning");
    render(<LearningTabs initialTab="certificates" certificatesCount={2} learningCount={5} certificates={<p>certs</p>} learning={<p>journey</p>} />);
    expect(screen.getByRole("tab", { name: "Learning (5)" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("journey")).toBeTruthy();
  });
});
