import { describe, expect, it } from "vitest";
import { expiringCerts, expiryBuckets, formatRate, ratePercent, rankingForDisplay, validCerts } from "@/features/dashboard/metrics";
import type { DashboardKpis, RankingRow } from "@/features/dashboard/schema";

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
  it("lists the five buckets in display order, zeros included, labelled by the shared expiry labels", () => {
    expect(expiryBuckets({ ...kpis, expiring60Certs: 0 })).toEqual([
      { status: "Active", label: "Còn hiệu lực", count: 2 },
      { status: "Expiring in 60d", label: "Hết hạn trong 60 ngày", count: 0 },
      { status: "Expiring Soon", label: "Sắp hết hạn", count: 1 },
      { status: "Expired", label: "Đã hết hạn", count: 1 },
      { status: "No Expiry", label: "Không thời hạn", count: 1 },
    ]);
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
