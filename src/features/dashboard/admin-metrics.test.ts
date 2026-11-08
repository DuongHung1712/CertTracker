import { describe, expect, it } from "vitest";
import {
  ADMIN_ATTENTION_LIMIT,
  countIssuedThisMonth,
  getAdminNeedsAttentionItems,
} from "@/features/dashboard/admin-metrics";
import type { RecordRow } from "@/features/records/queries";

function mockRecord(overrides: Partial<RecordRow> = {}): RecordRow {
  return {
    id: "rec-1",
    memberId: "mem-1",
    memberCode: "M001",
    memberName: "Test Member",
    memberEmail: "test@example.com",
    teamId: "team-1",
    teamName: "Team Cloud",
    courseId: "course-1",
    courseName: "Cloud Architecture",
    certTypeName: "Cloud",
    providerName: "AWS",
    validityMonths: 36,
    cost: null,
    costCurrency: null,
    estHours: null,
    status: "done",
    progress: 100,
    plannedExamDate: null,
    issuedDate: "2026-03-01",
    certificateUrl: null,
    hasEvidence: false,
    viaCompany: false,
    refundStatus: "n_a",
    notes: null,
    expiryDate: "2029-03-01",
    daysToExpiry: 100,
    expiryStatus: "Active",
    ...overrides,
  };
}

describe("admin-metrics", () => {
  // Boundaries through the public list only, so the expiry predicates can stay private or reuse manager-metrics.
  describe("Needs attention window: -1, 0, 30, 31, 60, 61 days", () => {
    const typeAt = (overrides: Partial<RecordRow>) =>
      getAdminNeedsAttentionItems([mockRecord(overrides)], 0).map((item) => item.type);

    it("lists -1 days as expired", () => {
      expect(typeAt({ daysToExpiry: -1 })).toEqual(["expired"]);
    });

    it("lists 0 and 30 days as expiring soon", () => {
      expect(typeAt({ daysToExpiry: 0 })).toEqual(["expiring_soon"]);
      expect(typeAt({ daysToExpiry: 30 })).toEqual(["expiring_soon"]);
    });

    it("does not list 31, 60 or 61 days", () => {
      for (const days of [31, 60, 61]) expect(typeAt({ daysToExpiry: days }), String(days)).toEqual([]);
    });

    it("never lists unfinished courses or certificates with no expiry", () => {
      expect(typeAt({ status: "in_progress", daysToExpiry: -5 })).toEqual([]);
      expect(typeAt({ status: "not_started", daysToExpiry: null })).toEqual([]);
      expect(typeAt({ daysToExpiry: null })).toEqual([]);
    });
  });

  describe("countIssuedThisMonth", () => {
    it("counts completed certificates issued in current month (Vietnam time)", () => {
      const now = new Date("2026-11-08T10:00:00Z");
      const records = [
        mockRecord({ id: "r1", status: "done", issuedDate: "2026-11-02" }),
        mockRecord({ id: "r2", status: "done", issuedDate: "2026-11-07" }),
        mockRecord({ id: "r3", status: "done", issuedDate: "2026-10-31" }), // previous month
        mockRecord({ id: "r4", status: "in_progress", issuedDate: "2026-11-05" }), // not done
      ];
      expect(countIssuedThisMonth(records, now)).toBe(2);
    });
  });

  describe("getAdminNeedsAttentionItems", () => {
    it("orders expired certificates most overdue first, then expiring <= 30d soonest first, then data quality", () => {
      const records: RecordRow[] = [
        mockRecord({
          id: "exp-far",
          memberName: "Alice",
          courseName: "Security+",
          daysToExpiry: -45,
        }),
        mockRecord({
          id: "exp-recent",
          memberName: "Bob",
          courseName: "Network+",
          daysToExpiry: -3,
        }),
        mockRecord({
          id: "urgent-soon",
          memberName: "Charlie",
          courseName: "Cloud+",
          daysToExpiry: 5,
        }),
        mockRecord({
          id: "urgent-later",
          memberName: "Diana",
          courseName: "Linux+",
          daysToExpiry: 25,
        }),
        mockRecord({
          id: "expiring-60",
          memberName: "Eve",
          courseName: "A+",
          daysToExpiry: 45, // not urgent (45 > 30)
        }),
      ];

      const items = getAdminNeedsAttentionItems(records, 2);

      expect(items).toHaveLength(5);
      // 1. Most overdue (-45 days)
      expect(items[0]).toMatchObject({
        type: "expired",
        label: "Alice · Security+",
        detail: "Expired 45 days ago",
      });
      // 2. Next overdue (-3 days)
      expect(items[1]).toMatchObject({
        type: "expired",
        label: "Bob · Network+",
        detail: "Expired 3 days ago",
      });
      // 3. Urgent soonest (5 days)
      expect(items[2]).toMatchObject({
        type: "expiring_soon",
        label: "Charlie · Cloud+",
        detail: "Expires in 5 days",
      });
      // 4. Urgent later (25 days)
      expect(items[3]).toMatchObject({
        type: "expiring_soon",
        label: "Diana · Linux+",
        detail: "Expires in 25 days",
      });
      // 5. Data quality item
      expect(items[4]).toMatchObject({
        type: "data_quality",
        count: 2,
        label: "Data quality",
        detail: "2 issues to check",
        href: "/data-quality",
      });
    });

    it("returns empty list if nothing is expired, expiring, or has dq issues", () => {
      const records = [mockRecord({ daysToExpiry: 120 })];
      const items = getAdminNeedsAttentionItems(records, 0);
      expect(items).toEqual([]);
    });

    it("formats 0 days remaining as 'Expires today'", () => {
      const records = [mockRecord({ daysToExpiry: 0 })];
      const items = getAdminNeedsAttentionItems(records, 0);
      expect(items[0].detail).toBe("Expires today");
    });

    it("cuts the certificates at the named limit but always keeps the data quality item", () => {
      expect(ADMIN_ATTENTION_LIMIT).toBe(10);
      const records = Array.from({ length: 12 }, (_, i) =>
        mockRecord({ id: `exp-${i}`, memberName: `Member ${i}`, daysToExpiry: -(i + 1) }),
      );
      const items = getAdminNeedsAttentionItems(records, 1);

      expect(items).toHaveLength(ADMIN_ATTENTION_LIMIT + 1);
      expect(items.filter((item) => item.type === "expired")).toHaveLength(ADMIN_ATTENTION_LIMIT);
      // Most overdue first, so the 2 least overdue (1 and 2 days) are the ones cut.
      expect(items[0]).toMatchObject({ type: "expired", detail: "Expired 12 days ago" });
      expect(items[ADMIN_ATTENTION_LIMIT]).toMatchObject({ type: "data_quality", count: 1, detail: "1 issue to check" });
    });
  });
});
