import { describe, expect, it } from "vitest";
import { NO_TEAM_LABEL, RECORD_STATUS_LABEL, ROLE_LABEL, clampPercent } from "@/components/status/labels";
import { ISSUE_META } from "@/features/data-quality/issues";

describe("labels", () => {
  it("labels record statuses in English", () => {
    expect(RECORD_STATUS_LABEL).toEqual({
      done: "Completed",
      in_progress: "In progress",
      not_started: "Not started",
    });
  });

  it("labels roles in English", () => {
    expect(ROLE_LABEL).toEqual({ admin: "Admin", manager: "Manager", member: "Member" });
  });

  it("uses one label for rows without a team in the issues list", () => {
    expect(NO_TEAM_LABEL).toBe("No team");
    expect(ISSUE_META.member_no_team.label).toBe(NO_TEAM_LABEL);
  });

  it("clamps and rounds progress", () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(47.6)).toBe(48);
    expect(clampPercent(140)).toBe(100);
  });
});
