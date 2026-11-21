// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLegendPopover } from "./skill-legend-popover";

describe("SkillLegendPopover component", () => {
  afterEach(cleanup);

  it("opens the 0–5 legend on click", async () => {
    const user = userEvent.setup();
    render(<SkillLegendPopover />);

    expect(screen.queryByText("Skill levels")).toBeNull();
    await user.click(screen.getByRole("button", { name: "What the levels 0–5 mean" }));

    expect(screen.getByText("Skill levels")).toBeDefined();
    expect(screen.getByText("No idea on the area (0%)")).toBeDefined();
    expect(screen.getByText("Know theory / limit knowledge (10-20%)")).toBeDefined();
    expect(screen.getByText("Minimal experience - with support from others (20-50%)")).toBeDefined();
    expect(screen.getByText("Average experience - can perform on own with minimal guidance (50-70%)")).toBeDefined();
    expect(screen.getByText("Advanced knowledge - extensive technical knowledge, go-to person, train others (70-100%)")).toBeDefined();
    expect(screen.getByText("SME / Expert - most experienced resource, extensive depth (100%+)")).toBeDefined();
  });
});
