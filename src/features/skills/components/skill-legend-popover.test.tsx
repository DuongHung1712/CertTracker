// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillLegendPopover } from "./skill-legend-popover";

describe("SkillLegendPopover component", () => {
  afterEach(cleanup);

  it("renders trigger button and opens popover with official 0–5 legend on click", async () => {
    const user = userEvent.setup();
    const handleOpenFullGuide = vi.fn();

    render(<SkillLegendPopover onOpenFullGuide={handleOpenFullGuide} />);

    const trigger = screen.getByRole("button", {
      name: /View official competency scale reference/i,
    });
    expect(trigger).toBeDefined();

    // Popover closed initially
    expect(screen.queryByText("Competency Scale Legend")).toBeNull();

    // Click trigger to open popover
    await user.click(trigger);

    expect(screen.getByText("Competency Scale Legend")).toBeDefined();
    expect(screen.getByText("0 – 5 Matrix")).toBeDefined();

    // Check all official spreadsheet definitions are rendered
    expect(screen.getByText("No idea on the area (0%)")).toBeDefined();
    expect(screen.getByText("Know theory / limit knowledge (10-20%)")).toBeDefined();
    expect(screen.getByText("Minimal experience - with support from others (20-50%)")).toBeDefined();
    expect(screen.getByText("Average experience - can perform on own with minimal guidance (50-70%)")).toBeDefined();
    expect(screen.getByText("Advanced knowledge - extensive technical knowledge, go-to person, train others (70-100%)")).toBeDefined();
    expect(screen.getByText("SME / Expert - most experienced resource, extensive depth (100%+)")).toBeDefined();

    // Check link to full details
    const fullDetailsBtn = screen.getByRole("button", { name: /Full Details/i });
    await user.click(fullDetailsBtn);
    expect(handleOpenFullGuide).toHaveBeenCalled();
  });

  it("renders custom triggerLabel if provided", () => {
    render(<SkillLegendPopover triggerLabel="Scale Guide" />);
    expect(screen.getByText("Scale Guide")).toBeDefined();
  });
});
