import { describe, expect, it } from "vitest";
import type { BreakdownRow } from "@/features/dashboard/schema";
import { matchesGroupFilters } from "./types";

function row(partial: Partial<BreakdownRow>): BreakdownRow {
  return {
    key: "k", label: "Team", headcount: null, people: 1, records: 5,
    done: 2, inProgress: 1, notStarted: 2, valid: 2, expired: 0, ...partial,
  };
}

describe("matchesGroupFilters", () => {
  it.each([
    ["all", row({}), true],
    ["has_expired", row({ expired: 1 }), true],
    ["has_expired", row({ expired: 0 }), false],
    ["has_in_progress", row({ inProgress: 0 }), false],
    ["has_in_progress", row({ inProgress: 2 }), true],
    ["no_completed", row({ done: 0 }), true],
    ["no_completed", row({ done: 1 }), false],
  ])("status %s keeps %o -> %s", (status, group, expected) => {
    expect(matchesGroupFilters(group, status, 0)).toBe(expected);
  });

  it("keeps groups with at least the minimum number of certificates", () => {
    expect(matchesGroupFilters(row({ records: 4 }), "all", 5)).toBe(false);
    expect(matchesGroupFilters(row({ records: 5 }), "all", 5)).toBe(true);
  });

  it("keeps everything for an unknown status", () => {
    expect(matchesGroupFilters(row({}), "nope", 0)).toBe(true);
  });
});
