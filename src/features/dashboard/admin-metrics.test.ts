import { describe, expect, it } from "vitest";
import {
  countIssuedThisMonth,
  EXPIRING_WINDOW_DAYS,
  getAdminNeedsAttentionItems,
  isAdminExpired,
  isAdminExpiring60,
  isAdminExpiringUrgent,
  isAdminValid,
  URGENT_WINDOW_DAYS,
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

describe("admin-metrics boundary tests", () => {
  it("shared constants match the system design thresholds", () => {
    expect(URGENT_WINDOW_DAYS).toBe(30);
    expect(EXPIRING_WINDOW_DAYS).toBe(60);
  });

  describe("exact threshold boundaries: -1, 0, 30, 31, 60, 61 days", () => {
    // -1 day: expired
    it("at -1 days: is expired, not valid, not expiring 60, not urgent", () => {
      const rec = mockRecord({ daysToExpiry: -1 });
      expect(isAdminExpired(rec)).toBe(true);
      expect(isAdminValid(rec)).toBe(false);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(false);
    });

    // 0 days: expires today (urgent boundary)
    it("at 0 days: is valid, not expired, is urgent, is expiring 60", () => {
      const rec = mockRecord({ daysToExpiry: 0 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(true);
      expect(isAdminExpiring60(rec)).toBe(true);
    });

    // 30 days: urgent upper boundary (URGENT_WINDOW_DAYS)
    it("at 30 days: is valid, not expired, is urgent, is expiring 60", () => {
      const rec = mockRecord({ daysToExpiry: 30 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(true);
      expect(isAdminExpiring60(rec)).toBe(true);
    });

    // 31 days: above urgent, within 60d
    it("at 31 days: is valid, not expired, NOT urgent, IS expiring 60", () => {
      const rec = mockRecord({ daysToExpiry: 31 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(true);
    });

    // 60 days: expiring 60 upper boundary (EXPIRING_WINDOW_DAYS)
    it("at 60 days: is valid, not expired, NOT urgent, IS expiring 60", () => {
      const rec = mockRecord({ daysToExpiry: 60 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(true);
    });

    // 61 days: beyond 60d window
    it("at 61 days: is valid, not expired, NOT urgent, NOT expiring 60", () => {
      const rec = mockRecord({ daysToExpiry: 61 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(false);
    });
  });

  describe("non-done statuses and null days to expiry", () => {
    it("in_progress records are never valid certificates, expired, or expiring", () => {
      const rec = mockRecord({ status: "in_progress", daysToExpiry: -5 });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(false);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(false);
    });

    it("not_started records are never valid certificates, expired, or expiring", () => {
      const rec = mockRecord({ status: "not_started", daysToExpiry: null });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(false);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(false);
    });

    it("completed certificates with no expiry date (null) are valid, but not expired or expiring", () => {
      const rec = mockRecord({ daysToExpiry: null });
      expect(isAdminExpired(rec)).toBe(false);
      expect(isAdminValid(rec)).toBe(true);
      expect(isAdminExpiringUrgent(rec)).toBe(false);
      expect(isAdminExpiring60(rec)).toBe(false);
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
        label: "Data quality issues",
        detail: "2 issues require attention",
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
  });
});
