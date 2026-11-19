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

describe("SkillsView master component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders the skill index KPI, role benchmark banner, and seed skills list", () => {
    render(<SkillsView />);

    // Benchmark banner
    expect(screen.getByText("Standard Target Role")).toBeDefined();
    expect(screen.getByText("Senior Software Engineer")).toBeDefined();
    expect(screen.getByText("Team Cloud")).toBeDefined();

    // 4 KPIs
    expect(screen.getByText("Skill Index")).toBeDefined();
    expect(screen.getByText("Certified Skills")).toBeDefined();
    expect(screen.getByText("Role Match")).toBeDefined();
    expect(screen.getByText("Growth Gaps")).toBeDefined();

    // Skills rendered
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.getByText("Kubernetes & Container Orchestration")).toBeDefined();
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();
  });

  it("filters skills when user switches category tabs", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    // Initially multiple categories visible
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();

    // Click 'Cloud & Infrastructure' tab
    const cloudTab = screen.getByRole("tab", { name: /Cloud & Infrastructure/i });
    await user.click(cloudTab);

    // Cloud skills should still be present
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    // Non-cloud skill like TypeScript should be filtered out
    expect(screen.queryByText("TypeScript & Type-Level Design")).toBeNull();

    // Click back to 'All Skills'
    const allTab = screen.getByRole("tab", { name: /All Skills/i });
    await user.click(allTab);
    expect(screen.getByText("TypeScript & Type-Level Design")).toBeDefined();
  });

  it("filters skills when typing in search input and clears via button", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const searchInput = screen.getByPlaceholderText("Search skills, certs, or domains...");
    await user.type(searchInput, "Kubernetes");

    // Only Kubernetes skill visible
    expect(screen.getByText("Kubernetes & Container Orchestration")).toBeDefined();
    expect(screen.queryByText("Cloud Architecture & AWS Services")).toBeNull();

    // Click clear search button
    const clearBtn = screen.getByRole("button", { name: "Clear search" });
    await user.click(clearBtn);

    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
  });

  it("toggles between Card Grid view and Compact Table view", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    // Initially in grid view (table element not present)
    expect(screen.queryByRole("table")).toBeNull();

    // Click Table view toggle
    const tableToggle = screen.getByRole("button", { name: "Table view" });
    await user.click(tableToggle);

    // Table now exists with headers
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByText("Skill & Domain")).toBeDefined();

    // Click Grid view toggle
    const gridToggle = screen.getByRole("button", { name: "Grid view" });
    await user.click(gridToggle);

    expect(screen.queryByRole("table")).toBeNull();
  });

  it("opens Scale Guide dialog when clicking Scale Guide button", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const guideBtn = screen.getByRole("button", { name: /Scale Guide \(0–5\)/i });
    await user.click(guideBtn);

    // Dialog title should appear
    expect(screen.getByText("Engineering Skill Competency Scale (0–5)")).toBeDefined();
    expect(screen.getByText(/Level 5 \(DC Master\) Governance Rule/i)).toBeDefined();
  });

  it("opens Skill Detail dialog when clicking Details button on a skill card", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const detailsButtons = screen.getAllByRole("button", { name: /Details/i });
    await user.click(detailsButtons[0]);

    // Detail dialog opens showing full evaluation
    expect(screen.getByText("Competency Evaluation")).toBeDefined();
    expect(screen.getByRole("button", { name: "Update Level Assessment" })).toBeDefined();
  });

  it("allows assessing a skill and updates competency level in real time", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(<SkillsView />);

    // Click Assess on the first card
    const assessButtons = screen.getAllByRole("button", { name: "Assess" });
    await user.click(assessButtons[0]);

    // Dialog should open
    expect(screen.getByText(/Assess Competency:/i)).toBeDefined();

    // Select Level 4
    const level4Btn = screen.getByRole("button", { name: /Level 4/i });
    await user.click(level4Btn);

    // Save
    const saveBtn = screen.getByRole("button", { name: "Save Assessment" });
    await user.click(saveBtn);

    // Toast triggered
    expect(toast.success).toHaveBeenCalled();
  });

  it("shows manager review notice when assessing at Level 5 and reverts verification when assessing below Level 5", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(<SkillsView />);

    // Find the skill that is self-assessed without cert proof: "Distributed Systems & Resilient Messaging"
    const skillTitle = screen.getByRole("button", { name: "Distributed Systems & Resilient Messaging" });
    expect(skillTitle).toBeDefined();

    const assessButtons = screen.getAllByRole("button", { name: "Assess" });
    // Let's click Assess on this skill
    await user.click(assessButtons[0]);

    // Select Level 5 (Master)
    const level5Btn = screen.getByRole("button", { name: /Level 5/i });
    await user.click(level5Btn);

    // Notice appears
    expect(screen.getByText("DC Master Requires Manager Endorsement")).toBeDefined();

    // Button label transforms to Request Manager Review
    const requestBtn = screen.getByRole("button", { name: "Request Manager Review" });
    await user.click(requestBtn);

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Requested Level 5 (DC Master) review"),
    );

    // Now re-assess the same first skill back to Level 3 (without manager review)
    const reAssessButtons = screen.getAllByRole("button", { name: "Assess" });
    await user.click(reAssessButtons[0]);

    const level3Btn = screen.getByRole("button", { name: /Level 3/i });
    await user.click(level3Btn);

    const saveBtn = screen.getByRole("button", { name: "Save Assessment" });
    await user.click(saveBtn);

    // Should succeed and NOT remain stuck in pending review
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Updated"));
  });

  it("filters to growth gaps when clicking Growth Gaps KPI card", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const gapsCard = screen.getByRole("button", { name: /Growth Gaps/i });
    await user.click(gapsCard);

    // Skills below target should be visible, skills meeting target should be hidden
    expect(screen.getByText("Information Security & CISSP Principles")).toBeDefined();
    expect(screen.queryByText("Cloud Architecture & AWS Services")).toBeNull();
  });

  it("shows Clear filters button in toolbar when filter is active and clears on click", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    // Initially no "Clear filters" in toolbar
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();

    // Select category 'Security & Compliance'
    const secTab = screen.getByRole("tab", { name: /Security & Compliance/i });
    await user.click(secTab);

    // Now Clear filters button is present in toolbar
    const clearFiltersBtn = screen.getByRole("button", { name: "Clear filters" });
    expect(clearFiltersBtn).toBeDefined();

    // Click Clear filters
    await user.click(clearFiltersBtn);

    // All skills restored
    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("opens detail dialog when clicking the skill title button", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const titleBtn = screen.getByRole("button", { name: "Cloud Architecture & AWS Services" });
    await user.click(titleBtn);

    // Detail dialog opens
    expect(screen.getByText("Competency Evaluation")).toBeDefined();
    expect(screen.getAllByText("AWS Certified Solutions Architect - Associate").length).toBeGreaterThanOrEqual(1);
  });

  it("resets seed skills when Reset Seed button is clicked", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    render(<SkillsView />);

    const resetBtn = screen.getByRole("button", { name: /Reset Seed/i });
    await user.click(resetBtn);

    expect(toast.info).toHaveBeenCalledWith("Reset skills data to initial demo seed");
  });

  it("shows empty state when no skills match filters and clears via button", async () => {
    const user = userEvent.setup();
    render(<SkillsView />);

    const searchInput = screen.getByPlaceholderText("Search skills, certs, or domains...");
    await user.type(searchInput, "nonexistent-skill-query-xyz");

    expect(screen.getByText("No skills match your filters")).toBeDefined();

    const clearAllBtn = screen.getByRole("button", { name: "Clear all filters" });
    await user.click(clearAllBtn);

    expect(screen.getByText("Cloud Architecture & AWS Services")).toBeDefined();
  });
});
