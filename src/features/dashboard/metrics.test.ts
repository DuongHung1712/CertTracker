import { describe, expect, it } from "vitest";
import { expiryMeta } from "@/components/status/expiry";
import {
  clampPercent,
  expiringCerts,
  expiryBuckets,
  formatRate,
  rankingForDisplay,
  ratePercent,
  roundedShare,
  studyStatusSplit,
  topExpiredGroups,
  topGroupsWithOthers,
  truncateLabel,
  validBuckets,
  validCerts,
  validVsExpiredSplit,
} from "@/features/dashboard/metrics";
import type { BreakdownRow, DashboardKpis, RankingRow } from "@/features/dashboard/schema";

const kpis: DashboardKpis = {
  totalMembers: 5, totalRecords: 8, doneRecords: 5, inProgressRecords: 2, notStartedRecords: 1,
  activeCerts: 2, expiring60Certs: 3, expiringSoonCerts: 1, expiredCerts: 1, noExpiryCerts: 1,
};

describe("ratePercent (decision #31: rounded DOWN, 100 only when everything is done)", () => {
  it("has no value when there is nothing to divide", () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(ratePercent(3, 0)).toBeNull();
  });
  it("rounds down", () => {
    expect(ratePercent(1, 3)).toBe(33);
    expect(ratePercent(2, 3)).toBe(66);
    expect(ratePercent(0, 5)).toBe(0);
  });
  it("never reaches 100 unless every record is done", () => {
    expect(ratePercent(997, 1000)).toBe(99);
    expect(ratePercent(999, 1000)).toBe(99);
    expect(ratePercent(3, 3)).toBe(100);
    expect(ratePercent(5, 3)).toBe(100); // impossible input, still bounded
  });
});

describe("ratePercent exactness (integer arithmetic, no float drift)", () => {
  it.each([
    [29, 100, 29],
    [57, 100, 57],
    [58, 100, 58],
    [29, 50, 58],
    [7, 100, 7],
    [14, 100, 14],
  ])("ratePercent(%i, %i) = %i", (done, total, expected) => {
    expect(ratePercent(done, total)).toBe(expected);
  });
  it("equals the exact integer floor, capped at 99, for every done < total up to 200", () => {
    for (let total = 1; total <= 200; total++) {
      for (let done = 0; done < total; done++) {
        // done * 100 stays far below 2^53, so plain integer arithmetic is exact here.
        expect(ratePercent(done, total), `${done}/${total}`).toBe(Math.min(99, Math.floor((done * 100) / total)));
      }
    }
  });
});

describe("formatRate", () => {
  it("shows a dash instead of 0% when there is no rate", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0)).toBe("0%");
    expect(formatRate(66)).toBe("66%");
  });
});

describe("validCerts / expiringCerts", () => {
  it("valid = every done bucket except Expired (No Expiry counts); expiring = the two ≤60-day buckets", () => {
    expect(validCerts(kpis)).toBe(2 + 3 + 1 + 1);
    expect(expiringCerts(kpis)).toBe(3 + 1);
  });
});

describe("expiryBuckets", () => {
  it("lists the five buckets in display order, zeros included, labelled with day ranges; the two expiring tiers use the badge labels", () => {
    expect(expiryBuckets({ ...kpis, expiring60Certs: 0 })).toEqual([
      { status: "Active", label: "More than 60 days", count: 2 },
      { status: "Expiring in 60d", label: "Expires in 31–60 days", count: 0 },
      { status: "Expiring Soon", label: "Expires within 30 days", count: 1 },
      { status: "Expired", label: "Expired", count: 1 },
      { status: "No Expiry", label: "No expiry", count: 1 },
    ]);
  });

  it("[copy] the 31–60 and 0–30 tiers read exactly like the badge (one source of words)", () => {
    const labelOf = (status: string) => expiryBuckets(kpis).find((b) => b.status === status)?.label;
    expect(labelOf("Expiring in 60d")).toBe(expiryMeta("Expiring in 60d").label);
    expect(labelOf("Expiring Soon")).toBe(expiryMeta("Expiring Soon").label);
  });
});

describe("rankingForDisplay", () => {
  const row = (fullName: string, rank: number, code: string): RankingRow => ({
    memberId: code, memberCode: code, fullName, teamName: null, validCerts: 0, doneCerts: 0, inProgress: 0, rank,
  });
  it("sorts by rank, then Vietnamese name order (Đ after D), then code; does not mutate", () => {
    const input = [row("Đào", 2, "M3"), row("Dũng", 2, "M2"), row("An", 2, "M1"), row("Bình", 1, "M4")];
    const copy = [...input];
    expect(rankingForDisplay(input).map((r) => r.fullName)).toEqual(["Bình", "An", "Dũng", "Đào"]);
    expect(input).toEqual(copy);
  });
});

describe("new visual helpers (spec §2 & §4)", () => {
  it("validBuckets returns the 4 valid segments summing to validCerts", () => {
    const buckets = validBuckets(kpis);
    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.label)).toEqual([
      "More than 60 days",
      "Expires in 31–60 days",
      "Expires within 30 days",
      "No expiry",
    ]);
    const sum = buckets.reduce((acc, b) => acc + b.count, 0);
    expect(sum).toBe(validCerts(kpis));
    expect(buckets[0].color).toBe("var(--status-active-fg)");
    expect(buckets[3].color).toBe("var(--status-no-expiry-fg)");
  });

  it("studyStatusSplit maps Completed / In progress / Not started using --chart-1..3", () => {
    const split = studyStatusSplit({ done: 5, inProgress: 2, notStarted: 1 });
    expect(split).toEqual([
      { key: "done", label: "Completed", count: 5, color: "var(--chart-1)" },
      { key: "inProgress", label: "In progress", count: 2, color: "var(--chart-2)" },
      { key: "notStarted", label: "Not started", count: 1, color: "var(--chart-3)" },
    ]);
  });

  it("validVsExpiredSplit maps Valid and Expired counts correctly", () => {
    const split = validVsExpiredSplit({ valid: 6, expired: 2 });
    expect(split).toEqual([
      { key: "valid", label: "Valid", count: 6, color: "var(--status-active-fg)" },
      { key: "expired", label: "Expired", count: 2, color: "var(--status-expired-fg)" },
    ]);
  });
});

function group(label: string, records: number, expired = 0): BreakdownRow {
  return { key: label, label, headcount: null, people: 1, records, done: 0, inProgress: 0, notStarted: 0, valid: 0, expired };
}

describe("topGroupsWithOthers", () => {
  it("keeps every group, biggest first, when there are no more than max", () => {
    expect(topGroupsWithOthers([group("a", 1), group("b", 5)], 6)).toEqual([
      { label: "b", records: 5 },
      { label: "a", records: 1 },
    ]);
  });

  it("folds the groups beyond max into one Others bar that sums them", () => {
    const rows = [group("a", 5), group("b", 4), group("c", 3), group("d", 2), group("e", 1)];
    expect(topGroupsWithOthers(rows, 3)).toEqual([
      { label: "a", records: 5 },
      { label: "b", records: 4 },
      { label: "c", records: 3 },
      { label: "Others", records: 3 },
    ]);
  });

  it("adds no Others bar when the groups beyond max have no records", () => {
    expect(topGroupsWithOthers([group("a", 2), group("b", 1), group("c", 0)], 2)).toHaveLength(2);
  });

  it("returns nothing for no rows and does not reorder the input", () => {
    expect(topGroupsWithOthers([], 6)).toEqual([]);
    const rows = [group("a", 1), group("b", 2)];
    topGroupsWithOthers(rows, 6);
    expect(rows.map((r) => r.label)).toEqual(["a", "b"]);
  });
});

describe("topExpiredGroups", () => {
  it("drops groups without expired certificates, sorts by expired and caps at max", () => {
    const rows = [group("a", 9, 0), group("b", 9, 2), group("c", 9, 5), group("d", 9, 1)];
    expect(topExpiredGroups(rows, 2).map((r) => r.label)).toEqual(["c", "b"]);
  });
});

describe("truncateLabel", () => {
  it("leaves a label of max characters alone and cuts a longer one to max with an ellipsis", () => {
    expect(truncateLabel("1234567", 7)).toBe("1234567");
    expect(truncateLabel("12345678", 7)).toBe("123456…");
  });
});

describe("roundedShare and clampPercent", () => {
  it("rounds to nearest and is 0 for an empty total", () => {
    expect(roundedShare(0, 0)).toBe(0);
    expect(roundedShare(1, 3)).toBe(33);
    expect(roundedShare(2, 3)).toBe(67);
    expect(roundedShare(199, 200)).toBe(100);
  });

  it("clamps into 0..100", () => {
    expect([clampPercent(-5), clampPercent(40), clampPercent(130)]).toEqual([0, 40, 100]);
  });
});
