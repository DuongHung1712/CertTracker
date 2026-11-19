// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SkillLevelBadge } from "./skill-level-badge";

describe("SkillLevelBadge", () => {
  afterEach(cleanup);

  it("renders level badge with correct label for Level 4 Expert", () => {
    render(<SkillLevelBadge currentLevel={4} targetLevel={3} />);

    expect(screen.getByText("L4 · Expert")).toBeDefined();
    expect(screen.getByText("+1 above standard")).toBeDefined();
  });

  it("renders status when below role standard target", () => {
    render(<SkillLevelBadge currentLevel={2} targetLevel={4} />);

    expect(screen.getByText("L2 · Intermediate")).toBeDefined();
    expect(screen.getByText("-2 below target")).toBeDefined();
  });

  it("renders 'Meets standard' when currentLevel equals targetLevel", () => {
    render(<SkillLevelBadge currentLevel={3} targetLevel={3} />);

    expect(screen.getByText("Meets standard")).toBeDefined();
  });

  it("renders level 5 DC Master label", () => {
    render(<SkillLevelBadge currentLevel={5} />);

    expect(screen.getByText("L5 · DC Master")).toBeDefined();
  });

  it("renders level 0 None label", () => {
    render(<SkillLevelBadge currentLevel={0} />);

    expect(screen.getByText("L0 · None")).toBeDefined();
  });
});
