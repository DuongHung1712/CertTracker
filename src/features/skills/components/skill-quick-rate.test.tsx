// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillQuickRate } from "./skill-quick-rate";

describe("SkillQuickRate component", () => {
  afterEach(cleanup);

  it("renders 0 to 5 rating pills with aria labels and checked status", () => {
    const handleRate = vi.fn();
    render(
      <SkillQuickRate
        skillId="skl-01"
        skillName="FastAPI & AsyncIO"
        currentLevel={3}
        targetLevel={4}
        onRate={handleRate}
      />,
    );

    const radiogroup = screen.getByRole("radiogroup", {
      name: /Rate proficiency for FastAPI & AsyncIO, currently level 3/i,
    });
    expect(radiogroup).toBeDefined();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(6);

    // Pill 3 should be checked
    expect(radios[3].getAttribute("aria-checked")).toBe("true");
    expect(radios[0].getAttribute("aria-checked")).toBe("false");
    expect(radios[4].getAttribute("aria-checked")).toBe("false");
  });

  it("triggers onRate callback when a pill is clicked", async () => {
    const user = userEvent.setup();
    const handleRate = vi.fn();

    render(
      <SkillQuickRate
        skillId="skl-01"
        skillName="FastAPI & AsyncIO"
        currentLevel={2}
        targetLevel={3}
        onRate={handleRate}
      />,
    );

    const level4Pill = screen.getByRole("radio", { name: /Level 4/i });
    await user.click(level4Pill);

    expect(handleRate).toHaveBeenCalledWith(4);
  });

  it("triggers onRate on digit key press (0–5) when radiogroup is focused", async () => {
    const user = userEvent.setup();
    const handleRate = vi.fn();

    render(
      <SkillQuickRate
        skillId="skl-01"
        skillName="FastAPI & AsyncIO"
        currentLevel={2}
        onRate={handleRate}
      />,
    );

    const radiogroup = screen.getByRole("radiogroup");
    radiogroup.focus();

    await user.keyboard("5");
    expect(handleRate).toHaveBeenCalledWith(5);

    await user.keyboard("0");
    expect(handleRate).toHaveBeenCalledWith(0);
  });

  it("supports arrow key navigation (ArrowRight and ArrowLeft)", async () => {
    const user = userEvent.setup();
    const handleRate = vi.fn();

    render(
      <SkillQuickRate
        skillId="skl-01"
        skillName="FastAPI & AsyncIO"
        currentLevel={2}
        onRate={handleRate}
      />,
    );

    const radiogroup = screen.getByRole("radiogroup");
    radiogroup.focus();

    await user.keyboard("{ArrowRight}");
    expect(handleRate).toHaveBeenCalledWith(3);

    await user.keyboard("{ArrowLeft}");
    expect(handleRate).toHaveBeenCalledWith(1);
  });

  it("does not fire onRate when disabled", async () => {
    const user = userEvent.setup();
    const handleRate = vi.fn();

    render(
      <SkillQuickRate
        skillId="skl-01"
        skillName="FastAPI & AsyncIO"
        currentLevel={2}
        disabled={true}
        onRate={handleRate}
      />,
    );

    const level4Pill = screen.getByRole("radio", { name: /Level 4/i });
    await user.click(level4Pill);

    expect(handleRate).not.toHaveBeenCalled();
  });
});
