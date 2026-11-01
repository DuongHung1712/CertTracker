import { describe, expect, it } from "vitest";
import { RECORD_STATUS_LABEL, ROLE_LABEL, clampPercent } from "@/components/status/labels";

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

  it("clamps and rounds progress", () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(47.6)).toBe(48);
    expect(clampPercent(140)).toBe(100);
  });
});
