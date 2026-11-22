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

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
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
  it("shows the member's guide to someone who has not dismissed it", () => {
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.getByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
    expect(screen.getByText("Add a certificate you hold")).toBeTruthy();
  });

  it("shows each role its own guide", () => {
    render(<UserGuideCard userId="u1" role="admin" />);
    expect(screen.getByText("Keep the Catalogue")).toBeTruthy();
    expect(screen.queryByText("Add a certificate you hold")).toBeNull();
  });

  it("renders nothing on the server, so a dismissed guide never flashes", () => {
    expect(renderToStaticMarkup(<UserGuideCard userId="u1" role="member" />)).toBe("");
  });

  it("Don't show again hides it now and at the next sign-in, for this person only", async () => {
    const { unmount } = render(<UserGuideCard userId="u1" role="member" />);
    await userEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
    unmount();

    sessionStorage.clear(); // a new sign-in is a new browser session
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

    sessionStorage.clear();
    render(<UserGuideCard userId="u1" role="member" />);
    expect(screen.getByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
  });

  it("shows again on request (the menu's User guide) even after Don't show again", async () => {
    const first = render(<UserGuideCard userId="u1" role="member" />);
    await userEvent.click(screen.getByRole("button", { name: "Don't show again" }));
    first.unmount();

    render(<UserGuideCard userId="u1" role="member" forceOpen />);
    expect(await screen.findByRole("region", { name: "Welcome to CertTracker" })).toBeTruthy();
    // ?guide=1 comes off the address, so a refresh does not undo the next "Don't show again".
    expect(replace).toHaveBeenCalledWith("/dashboard", { scroll: false });
  });

  it("stays dismissed after a refresh once the address has no ?guide=1", async () => {
    const first = render(<UserGuideCard userId="u1" role="member" forceOpen />);
    await userEvent.click(await screen.findByRole("button", { name: "Don't show again" }));
    first.unmount();
    render(<UserGuideCard userId="u1" role="member" forceOpen={false} />);
    expect(screen.queryByRole("region", { name: "Welcome to CertTracker" })).toBeNull();
  });
});
