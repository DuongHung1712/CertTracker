// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillsView } from "./skills-view";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SkillsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders the role, the four summary numbers and the member's skills", () => {
    render(<SkillsView />);

    expect(screen.getByRole("heading", { name: /Senior Software Engineer/ })).toBeDefined();
    expect(screen.getByText("Average level")).toBeDefined();
    expect(screen.getByText("Level 4 or higher")).toBeDefined();
    expect(screen.getByText("Waiting for review", { selector: "dt" })).toBeDefined();
    expect(screen.getByText("Certified", { selector: "dt" })).toBeDefined();

    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();
    // Catalogue skills outside the member's profile are not listed on the page.
    expect(screen.queryByText("Python (FastAPI & AsyncIO)")).toBeNull();
  });

  it("filters by category tab", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.click(screen.getByRole("tab", { name: /Cloud & Infrastructure/i }));
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.queryByText("TypeScript & Type-Level Design")).toBeNull();

    await user.click(screen.getByRole("tab", { name: /All skills/i }));
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();
  });

  it("searches, then clears every filter", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.type(screen.getByRole("searchbox", { name: "Search skills or certificates" }), "Kubernetes");
    expect(screen.getByText("Kubernetes & Container Orchestration")).toBeDefined();
    expect(screen.queryByText("Cloud Architecture & AWS Services")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("shows an empty state and recovers from it", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.type(screen.getByRole("searchbox", { name: "Search skills or certificates" }), "nothing-like-this");
    expect(screen.getByText("No skills match these filters")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
  });

  it("switches between card and table view", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    expect(screen.queryByRole("table")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Table view" }));
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: /Your level/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Card view" }));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("opens the level guide", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.click(screen.getByRole("button", { name: "Level guide" }));
    expect(screen.getByRole("heading", { name: "Skill levels 0–5" })).toBeDefined();
  });

  it("opens the details from the skill name and moves on to editing", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.click(screen.getByRole("button", { name: "Cloud Architecture & AWS Services" }));
    expect(screen.getAllByText("AWS Certified Solutions Architect - Associate").length).toBeGreaterThanOrEqual(1);

    await user.click(screen.getByRole("button", { name: "Edit rating" }));
    expect(screen.getByRole("heading", { name: "Rate Cloud Architecture & AWS Services" })).toBeDefined();
  });

  it("rates in one click on a card and in the table", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(<SkillsView />);

    await user.click(screen.getAllByRole("radio", { name: /^Level 4/ })[0]);
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining("level 4"));

    await user.click(screen.getByRole("button", { name: "Table view" }));
    await user.click(screen.getAllByRole("radio", { name: /^Level 2/ })[0]);
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining("level 2"));
  });

  it("sends level 5 for review, and a lower level clears the review", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(<SkillsView />);

    await user.click(screen.getByRole("button", { name: "Edit Distributed Systems & Resilient Messaging" }));
    await user.click(screen.getByRole("radio", { name: /^5 · Master/ }));
    expect(screen.getByText(/Level 5 needs your manager/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Send for review" }));
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining("waiting for manager review"));

    await user.click(screen.getByRole("button", { name: "Edit Distributed Systems & Resilient Messaging" }));
    await user.click(screen.getByRole("radio", { name: /^3 · Advanced/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(toast.success).toHaveBeenLastCalledWith(expect.stringContaining("set to level 3"));
  });

  it("opens Update skill rate and saves even when optional catalog skills are unrated", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.click(screen.getByRole("button", { name: "Update skill rate" }));
    expect(screen.getByRole("heading", { name: "Update skill rate" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Save ratings" }));
    expect(screen.queryByRole("alert")).toBeNull();
  }, 15_000);

  it("highlights unrated profile skills on Save ratings", async () => {
    const user = userEvent.setup();
    const { SEED_SKILLS } = await import("../seed-data");
    render(<SkillsView initialSkills={[{ ...SEED_SKILLS[0], currentLevel: 0 }, ...SEED_SKILLS.slice(1)]} />);

    await user.click(screen.getByRole("button", { name: "Update skill rate" }));
    await user.click(screen.getByRole("button", { name: "Save ratings" }));
    expect(screen.getByRole("alert").textContent).toContain("Rate all missing skills before saving (1 left).");
  }, 15_000);

  it("opens the 0–5 legend from the table header", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    await user.click(screen.getByRole("button", { name: "Table view" }));
    await user.click(screen.getByRole("button", { name: "What the levels 0–5 mean" }));
    expect(screen.getByText("No idea on the area (0%)")).toBeDefined();
  });
});
