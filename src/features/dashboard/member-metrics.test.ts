import { describe, expect, it } from "vitest";
import type { RecordRow } from "@/features/records/queries";
import {
  calculateMemberKpis,
  extractFirstName,
  filterMemberRecords,
  getAttentionRecord,
  getGreeting,
  getGreetingTimeOfDay,
  getMemberTabCounts,
} from "./member-metrics";

function makeRecord(partial: Partial<RecordRow>): RecordRow {
  return {
    id: "r1",
    memberId: "m1",
    memberCode: "M001",
    memberName: "Lê Minh Châu",
    memberEmail: "member@certtracker.test",
    teamId: "t1",
    teamName: "Team Cloud",
    courseId: "c1",
    courseName: "AWS Solutions Architect Associate",
    certTypeName: "Cloud",
    providerName: "AWS",
    validityMonths: 36,
    cost: 150,
    costCurrency: "USD",
    estHours: 40,
    status: "done",
    progress: 100,
    plannedExamDate: null,
    issuedDate: "2023-10-01",
    certificateUrl: null,
    hasEvidence: true,
    viaCompany: false,
    refundStatus: "n_a",
    notes: null,
    expiryDate: "2026-10-01",
    daysToExpiry: 120,
    expiryStatus: "active",
    ...partial,
  };
}

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
    // 08:30 VN is morning (UTC 01:30)
    const morning = new Date("2026-11-08T01:30:00Z");
    expect(getGreetingTimeOfDay(morning)).toBe("morning");
    expect(getGreeting("Lê Minh Châu", morning)).toBe("Good morning, Châu");

    // 14:00 VN is afternoon (UTC 07:00)
    const afternoon = new Date("2026-11-08T07:00:00Z");
    expect(getGreetingTimeOfDay(afternoon)).toBe("afternoon");
    expect(getGreeting("Lê Minh Châu", afternoon)).toBe("Good afternoon, Châu");

    // 20:00 VN is evening (UTC 13:00)
    const evening = new Date("2026-11-08T13:00:00Z");
    expect(getGreetingTimeOfDay(evening)).toBe("evening");
    expect(getGreeting("Lê Minh Châu", evening)).toBe("Good evening, Châu");
  });
});

describe("getAttentionRecord", () => {
  it("returns null when records are empty or have no expiry", () => {
    expect(getAttentionRecord([])).toBeNull();
    expect(
      getAttentionRecord([
        makeRecord({ status: "not_started", expiryDate: null, daysToExpiry: null }),
        makeRecord({ status: "done", expiryDate: null, daysToExpiry: null, expiryStatus: "no-expiry" }),
      ]),
    ).toBeNull();
  });

  it("returns null when all completed certificates have > 60 days left", () => {
    expect(
      getAttentionRecord([
        makeRecord({ daysToExpiry: 61, expiryStatus: "active" }),
        makeRecord({ daysToExpiry: 180, expiryStatus: "active" }),
      ]),
    ).toBeNull();
  });

  it("returns urgent record when certificate expires within 30 days", () => {
    const r1 = makeRecord({ id: "r1", courseName: "Course A", daysToExpiry: 25, expiryStatus: "expiring-soon" });
    const r2 = makeRecord({ id: "r2", courseName: "Course B", daysToExpiry: 50, expiryStatus: "expiring-60" });
    const result = getAttentionRecord([r1, r2]);
    expect(result).not.toBeNull();
    expect(result?.record.id).toBe("r1");
    expect(result?.urgency).toBe("urgent");
  });

  it("returns expiring record when certificate expires between 31 and 60 days", () => {
    const r = makeRecord({ id: "r1", daysToExpiry: 45, expiryStatus: "expiring-60" });
    const result = getAttentionRecord([r]);
    expect(result).not.toBeNull();
    expect(result?.record.id).toBe("r1");
    expect(result?.urgency).toBe("expiring");
  });

  it("prioritizes expired certificates over expiring ones", () => {
    const expiring = makeRecord({ id: "expiring", daysToExpiry: 10, expiryStatus: "expiring-soon" });
    const expired = makeRecord({ id: "expired", daysToExpiry: -5, expiryStatus: "expired" });
    const result = getAttentionRecord([expiring, expired]);
    expect(result).not.toBeNull();
    expect(result?.record.id).toBe("expired");
    expect(result?.urgency).toBe("expired");
  });
});

describe("calculateMemberKpis", () => {
  it("calculates correct counts for diverse member records", () => {
    const records = [
      makeRecord({ id: "1", status: "done", daysToExpiry: 120 }), // valid long
      makeRecord({ id: "2", status: "done", daysToExpiry: 20 }), // valid & expiring soon
      makeRecord({ id: "3", status: "done", daysToExpiry: -10 }), // expired
      makeRecord({ id: "4", status: "in_progress", progress: 60 }), // in progress
      makeRecord({ id: "5", status: "not_started" }), // not started
    ];

    const kpis = calculateMemberKpis(records);
    expect(kpis.total).toBe(5);
    expect(kpis.validCount).toBe(2); // id 1 and 2
    expect(kpis.expiringCount).toBe(1); // id 2
    expect(kpis.leastDaysRecord?.id).toBe("2");
    expect(kpis.inProgressCount).toBe(1);
    expect(kpis.inProgressRows).toHaveLength(1);
    expect(kpis.expiredCount).toBe(1);
  });

  it("handles empty records", () => {
    const kpis = calculateMemberKpis([]);
    expect(kpis.total).toBe(0);
    expect(kpis.validCount).toBe(0);
    expect(kpis.expiringCount).toBe(0);
    expect(kpis.leastDaysRecord).toBeNull();
    expect(kpis.inProgressCount).toBe(0);
    expect(kpis.expiredCount).toBe(0);
  });
});

describe("getMemberTabCounts & filterMemberRecords", () => {
  const records = [
    makeRecord({ id: "1", courseName: "AWS Solution", status: "done", daysToExpiry: 15 }),
    makeRecord({ id: "2", courseName: "Google Cloud", status: "done", daysToExpiry: 90 }),
    makeRecord({ id: "3", courseName: "Azure Dev", status: "done", daysToExpiry: -5 }),
    makeRecord({ id: "4", courseName: "Python Basics", status: "in_progress", progress: 40 }),
  ];

  it("computes counts per tab accurately", () => {
    const counts = getMemberTabCounts(records);
    expect(counts.all).toBe(4);
    expect(counts.valid).toBe(2); // AWS (15) and Google (90)
    expect(counts.expiring).toBe(1); // AWS (15)
    expect(counts.in_progress).toBe(1); // Python
  });

  it("filters correctly by tab", () => {
    expect(filterMemberRecords(records, "all")).toHaveLength(4);
    expect(filterMemberRecords(records, "valid")).toHaveLength(2);
    expect(filterMemberRecords(records, "expiring")).toHaveLength(1);
    expect(filterMemberRecords(records, "in_progress")).toHaveLength(1);
  });

  it("sorts by expiry (default) and name", () => {
    const byExpiry = filterMemberRecords(records, "all", "expiry");
    expect(byExpiry[0].id).toBe("3"); // -5 days
    expect(byExpiry[1].id).toBe("1"); // 15 days
    expect(byExpiry[2].id).toBe("2"); // 90 days
    expect(byExpiry[3].id).toBe("4"); // null days

    const byName = filterMemberRecords(records, "all", "name");
    expect(byName[0].courseName).toBe("AWS Solution");
    expect(byName[1].courseName).toBe("Azure Dev");
    expect(byName[2].courseName).toBe("Google Cloud");
    expect(byName[3].courseName).toBe("Python Basics");
  });
});
