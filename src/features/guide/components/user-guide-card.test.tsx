// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUIDE } from "@/features/guide/content";
import { UserGuideCard } from "@/features/guide/components/user-guide-card";

const replace = vi.fn();
// One object for every render, as the App Router gives: the guide's effect must not run again on each render.
const router = { replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** Forget every cookie the guide set (a new browser). */
function clearCookies() {
  for (const pair of document.cookie.split("; ")) {
    const name = pair.split("=")[0];
    if (name) document.cookie = `${name}=; path=/; max-age=0`;
  }
}
/** A new sign-in: session cookies are gone, the year-long one stays. */
function endSession() {
  for (const pair of document.cookie.split("; ")) {
    const name = pair.split("=")[0];
    if (name.startsWith("ct-guide-hidden-")) document.cookie = `${name}=; path=/; max-age=0`;
  }
}

beforeEach(() => {
  clearCookies();
  replace.mockClear();
});
afterEach(cleanup);

describe("GUIDE", () => {
  it("has plain-worded steps for every role", () => {
    for (const role of ["member", "manager", "admin"] as const) {
      expect(GUIDE[role].steps.length).toBeGreaterThanOrEqual(3);
      for (const step of GUIDE[role].steps) {
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.text.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("UserGuideCard", () => {
  it("is one line until Show steps is pressed", async () => {
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.getByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
    expect(screen.queryByText("Add a certificate you hold")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show steps" }));
    expect(screen.getByText("Add a certificate you hold")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide steps" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("has no heading, so it never comes before the page title in heading order", () => {
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("shows each role its own guide", async () => {
    render(<UserGuideCard userId="u1" role="admin" />);
    await userEvent.click(screen.getByRole("button", { name: "Show steps" }));
    expect(screen.getByText("Keep the Catalogue")).toBeTruthy();
    expect(screen.queryByText("Add a certificate you hold")).toBeNull();
  });

  it("is in the server render when the cookies allow it, and absent when they do not", () => {
    expect(renderToStaticMarkup(<UserGuideCard userId="u1" role="member" initialVisible />)).toContain("Welcome to CertTracker");
    expect(renderToStaticMarkup(<UserGuideCard userId="u1" role="member" initialVisible={false} />)).toBe("");
  });

  it("Don't show again hides it now and at the next sign-in, for this person only", async () => {
    const { unmount } = render(<UserGuideCard userId="u1" role="member" />);
    await userEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
    unmount();

    endSession(); // a new sign-in is a new browser session
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
    cleanup();

    render(<UserGuideCard userId="u2" role="member" />);
    expect(screen.getByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
  });

  it("Hide for now hides it for this visit but it returns at the next sign-in", async () => {
    const { unmount } = render(<UserGuideCard userId="u1" role="member" />);
    await userEvent.click(screen.getByRole("button", { name: "Hide for now" }));
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
    unmount();

    endSession();
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.getByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
  });

  it("shows again on request (the menu's User guide) even after Don't show again", async () => {
    const first = render(<UserGuideCard userId="u1" role="member" />);
    await userEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    first.unmount();

    render(<UserGuideCard userId="u1" role="member" forceOpen />);
    expect(await screen.findByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
    expect(screen.getByText("Add a certificate you hold")).toBeTruthy(); // opened with its steps
    // ?guide=1 comes off the address, so a refresh does not undo the next "Don't show again".
    expect(replace).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("expands steps when forceOpen flips to true on an already-mounted card", async () => {
    const { rerender } = render(<UserGuideCard userId="u1" role="member" forceOpen={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Hide for now" }));
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();

    rerender(<UserGuideCard userId="u1" role="member" forceOpen />);
    expect(await screen.findByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
    expect(screen.getByText("Add a certificate you hold")).toBeTruthy();
  });

  it("stays dismissed after a refresh once the address has no ?guide=1", async () => {
    const first = render(<UserGuideCard userId="u1" role="member" forceOpen />);
    await userEvent.click(await screen.findByRole("button", { name: "Don't show again" }));
    first.unmount();
    render(<UserGuideCard userId="u1" role="member" forceOpen={false} />);
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
  });
});
