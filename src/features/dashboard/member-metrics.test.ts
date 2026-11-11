import { describe, expect, it } from "vitest";
import { doneRecord, makeRecord, noExpiryRecord } from "@/features/records/__fixtures__/record-row";
import {
  calculateMemberKpis,
  expiryWindow,
  extractFirstName,
  filterMemberRecords,
  getAttentionRecord,
  getGreeting,
  getGreetingTimeOfDay,
  getMemberTabCounts,
} from "./member-metrics";

const notDated = { issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" } as const;
const inProgress = (id: string) => makeRecord({ id, status: "in_progress", progress: 40, ...notDated });
const notStarted = (id: string) => makeRecord({ id, status: "not_started", progress: 0, ...notDated });

describe("extractFirstName", () => {
  it("extracts the given name from Vietnamese full names", () => {
    expect(extractFirstName("Lê Minh Châu")).toBe("Châu");
    expect(extractFirstName("Nguyễn Văn An")).toBe("An");
    expect(extractFirstName("Trần Thị Bình")).toBe("Bình");
    expect(extractFirstName("Nguyễn Thị Hằng")).toBe("Hằng");
  });

  it("handles single-word and western names", () => {
    expect(extractFirstName("Châu")).toBe("Châu");
    expect(extractFirstName("John")).toBe("John");
    expect(extractFirstName("Alice Smith")).toBe("Smith");
  });

  it("handles empty or whitespace strings", () => {
    expect(extractFirstName("")).toBe("there");
    expect(extractFirstName("   ")).toBe("there");
  });
});

describe("getGreetingTimeOfDay & getGreeting", () => {
  it("determines morning, afternoon, and evening in Asia/Ho_Chi_Minh", () => {
    const morning = new Date("2026-11-08T01:30:00Z"); // 08:30 VN
    expect(getGreeting("Lê Minh Châu", morning)).toBe("Good morning, Châu");
    const afternoon = new Date("2026-11-08T07:00:00Z"); // 14:00 VN
    expect(getGreeting("Lê Minh Châu", afternoon)).toBe("Good afternoon, Châu");
    const evening = new Date("2026-11-08T13:00:00Z"); // 20:00 VN
    expect(getGreeting("Lê Minh Châu", evening)).toBe("Good evening, Châu");
  });

  // VN is UTC+7, so VN hh:mm = UTC (hh-7):mm.
  it.each([
    ["00:30", "2026-11-07T17:30:00Z", "evening"],
    ["04:59", "2026-11-07T21:59:00Z", "evening"],
    ["05:00", "2026-11-07T22:00:00Z", "morning"],
    ["11:59", "2026-11-08T04:59:00Z", "morning"],
    ["12:00", "2026-11-08T05:00:00Z", "afternoon"],
    ["17:59", "2026-11-08T10:59:00Z", "afternoon"],
    ["18:00", "2026-11-08T11:00:00Z", "evening"],
  ] as const)("%s VN is %s", (_vn, utc, expected) => {
    expect(getGreetingTimeOfDay(new Date(utc))).toBe(expected);
  });
});

/*
 * Boundary days follow SQL `expiry_status()` (migration 20260928000003):
 * < 0 Expired, 0–30 Expiring Soon, 31–60 Expiring in 60d, > 60 Active, null validity No Expiry.
 * "Valid" = done and not Expired (No Expiry included); "Expiring" = Expiring Soon + Expiring in 60d.
 * Characterization: these pass on 4a89dfd and must keep passing after the WP4 refactor.
 */
const BOUNDARIES = [
  { days: -1, valid: false, expiring: false, expired: true, attention: "expired" },
  { days: 0, valid: true, expiring: true, expired: false, attention: "urgent" },
  { days: 30, valid: true, expiring: true, expired: false, attention: "urgent" },
  { days: 31, valid: true, expiring: true, expired: false, attention: "expiring" },
  { days: 60, valid: true, expiring: true, expired: false, attention: "expiring" },
  { days: 61, valid: true, expiring: false, expired: false, attention: null },
] as const;

describe("threshold boundaries (-1, 0, 30, 31, 60, 61)", () => {
  it.each(BOUNDARIES)("day $days: attention $attention", ({ days, attention }) => {
    const result = getAttentionRecord([doneRecord(days)]);
    expect(result?.urgency ?? null).toBe(attention);
  });

  it.each(BOUNDARIES)("day $days: KPI valid=$valid expiring=$expiring expired=$expired", ({ days, valid, expiring, expired }) => {
    const kpis = calculateMemberKpis([doneRecord(days)]);
    expect(kpis.validCount).toBe(valid ? 1 : 0);
    expect(kpis.expiringCount).toBe(expiring ? 1 : 0);
    expect(kpis.expiredCount).toBe(expired ? 1 : 0);
    expect(kpis.leastDaysRecord?.daysToExpiry ?? null).toBe(expiring ? days : null);
  });

  it.each(BOUNDARIES)("day $days: tab counts valid=$valid expiring=$expiring", ({ days, valid, expiring }) => {
    const counts = getMemberTabCounts([doneRecord(days)]);
    expect(counts).toEqual({ all: 1, valid: valid ? 1 : 0, expiring: expiring ? 1 : 0, in_progress: 0 });
  });

  it.each(BOUNDARIES)("day $days: tab filters valid=$valid expiring=$expiring", ({ days, valid, expiring }) => {
    const records = [doneRecord(days)];
    expect(filterMemberRecords(records, "valid")).toHaveLength(valid ? 1 : 0);
    expect(filterMemberRecords(records, "expiring")).toHaveLength(expiring ? 1 : 0);
    expect(filterMemberRecords(records, "in_progress")).toHaveLength(0);
    expect(filterMemberRecords(records, "all")).toHaveLength(1);
  });

  it("counts a mixed list with known numbers per tab", () => {
    // Done at -1, 0, 30, 31, 60, 61 days, one No Expiry, one in progress, one not started.
    const records = [
      ...BOUNDARIES.map((b, i) => doneRecord(b.days, { id: `d${i}` })),
      noExpiryRecord({ id: "ne" }),
      inProgress("ip"),
      notStarted("ns"),
    ];
    expect(getMemberTabCounts(records)).toEqual({ all: 9, valid: 6, expiring: 4, in_progress: 1 });
    expect(filterMemberRecords(records, "valid").map((r) => r.id).sort()).toEqual(["d1", "d2", "d3", "d4", "d5", "ne"]);
    expect(filterMemberRecords(records, "expiring").map((r) => r.id).sort()).toEqual(["d1", "d2", "d3", "d4"]);
    expect(filterMemberRecords(records, "in_progress").map((r) => r.id)).toEqual(["ip"]);
  });

  it("an unknown tab falls back to all records instead of throwing", () => {
    const records = [doneRecord(10, { id: "a" }), inProgress("b")];
    // The list casts the Tabs value (`val as MemberTab`), so a stray value can reach the filter.
    const unknown = "archived" as unknown as Parameters<typeof filterMemberRecords>[1];
    expect(filterMemberRecords(records, unknown).map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});

describe("null daysToExpiry (No Expiry, N/A, not done)", () => {
  const records = [noExpiryRecord({ id: "ne" }), inProgress("ip"), notStarted("ns")];

  it("No Expiry counts as valid, never as expiring or expired", () => {
    const kpis = calculateMemberKpis(records);
    expect(kpis).toMatchObject({ total: 3, validCount: 1, expiringCount: 0, expiredCount: 0, inProgressCount: 1 });
    expect(kpis.leastDaysRecord).toBeNull();
    expect(getMemberTabCounts(records)).toEqual({ all: 3, valid: 1, expiring: 0, in_progress: 1 });
    expect(filterMemberRecords(records, "valid").map((r) => r.id)).toEqual(["ne"]);
  });

  it("needs no attention", () => {
    expect(getAttentionRecord(records)).toBeNull();
  });

  it("an in-progress record never needs expiry attention even if it carries a past date", () => {
    expect(getAttentionRecord([makeRecord({ status: "in_progress", daysToExpiry: -3, expiryStatus: "Expired" })])).toBeNull();
  });
});

describe("no completed records", () => {
  it("everything is zero and nothing needs attention", () => {
    const records = [inProgress("ip"), notStarted("ns")];
    expect(calculateMemberKpis(records)).toMatchObject({ validCount: 0, expiringCount: 0, expiredCount: 0 });
    expect(getAttentionRecord(records)).toBeNull();
    expect(getAttentionRecord([])).toBeNull();
  });
});

describe("getAttentionRecord ordering", () => {
  it("picks the record with the fewest days left among expiring ones", () => {
    const result = getAttentionRecord([
      doneRecord(50, { id: "b", certificateName: "Course B" }),
      doneRecord(25, { id: "a", certificateName: "Course A" }),
    ]);
    expect(result).toEqual({ record: expect.objectContaining({ id: "a" }), urgency: "urgent" });
  });

  it("prioritizes expired certificates over expiring ones, most recently expired first", () => {
    const result = getAttentionRecord([
      doneRecord(10, { id: "expiring" }),
      doneRecord(-40, { id: "old" }),
      doneRecord(-5, { id: "recent" }),
    ]);
    expect(result).toEqual({ record: expect.objectContaining({ id: "recent" }), urgency: "expired" });
  });
});

describe("calculateMemberKpis", () => {
  it("calculates correct counts for diverse member records", () => {
    const kpis = calculateMemberKpis([
      doneRecord(120, { id: "1" }),
      doneRecord(20, { id: "2" }),
      doneRecord(-10, { id: "3" }),
      inProgress("4"),
      notStarted("5"),
    ]);
    expect(kpis.total).toBe(5);
    expect(kpis.validCount).toBe(2);
    expect(kpis.expiringCount).toBe(1);
    expect(kpis.leastDaysRecord?.id).toBe("2");
    expect(kpis.inProgressCount).toBe(1);
    expect(kpis.inProgressRows).toHaveLength(1);
    expect(kpis.expiredCount).toBe(1);
  });

  it("handles empty records", () => {
    expect(calculateMemberKpis([])).toEqual({
      total: 0,
      validCount: 0,
      expiringCount: 0,
      leastDaysRecord: null,
      inProgressCount: 0,
      inProgressRows: [],
      expiredCount: 0,
    });
  });
});

describe("filterMemberRecords sorting", () => {
  const records = [
    doneRecord(15, { id: "1", certificateName: "AWS Solution" }),
    doneRecord(90, { id: "2", certificateName: "Google Cloud" }),
    doneRecord(-5, { id: "3", certificateName: "Azure Dev" }),
    makeRecord({ id: "4", certificateName: "Python Basics", status: "in_progress", progress: 40, ...notDated }),
  ];

  it("sorts by expiry (default): dated ascending, undated last", () => {
    expect(filterMemberRecords(records, "all", "expiry").map((r) => r.id)).toEqual(["3", "1", "2", "4"]);
  });

  it("sorts by name (Vietnamese collation)", () => {
    expect(filterMemberRecords(records, "all", "name").map((r) => r.certificateName)).toEqual([
      "AWS Solution",
      "Azure Dev",
      "Google Cloud",
      "Python Basics",
    ]);
  });
});

describe("expiryWindow (mirrors SQL expiry_status())", () => {
  it.each([
    [null, "none"],
    [-1, "expired"],
    [0, "urgent"],
    [30, "urgent"],
    [31, "expiring"],
    [60, "expiring"],
    [61, "later"],
  ] as const)("%s days -> %s", (days, window) => {
    expect(expiryWindow(days)).toBe(window);
  });
});

describe("member KPIs: a course completion is not a valid certificate", () => {
  it("counts only exam certificates as valid", () => {
    const completion = makeRecord({ id: "c", certificateKind: "completion", daysToExpiry: null, expiryDate: null, expiryStatus: "No Expiry" });
    const kpis = calculateMemberKpis([makeRecord({ id: "e", daysToExpiry: 200 }), completion]);
    expect(kpis).toMatchObject({ total: 2, validCount: 1 });
  });
});

describe("member attention: a completion with a validity is never flagged", () => {
  it("returns no attention record", () => {
    const records = [
      doneRecord(-5, { id: "c1", certificateKind: "completion" }),
      doneRecord(10, { id: "c2", certificateKind: "completion" }),
    ];
    expect(getAttentionRecord(records)).toBeNull();
  });
});
