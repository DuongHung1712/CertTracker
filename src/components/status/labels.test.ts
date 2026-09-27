import { describe, expect, it } from "vitest";
import { RECORD_STATUS_LABEL, ROLE_LABEL, clampPercent } from "@/components/status/labels";

describe("labels", () => {
  it("labels record statuses in Vietnamese", () => {
    expect(RECORD_STATUS_LABEL).toEqual({
      done: "Hoàn thành",
      in_progress: "Đang học",
      not_started: "Chưa bắt đầu",
    });
  });

  it("labels roles in Vietnamese", () => {
    expect(ROLE_LABEL).toEqual({ admin: "Quản trị", manager: "Quản lý", member: "Thành viên" });
  });

  it("clamps and rounds progress", () => {
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(47.6)).toBe(48);
    expect(clampPercent(140)).toBe(100);
  });
});
