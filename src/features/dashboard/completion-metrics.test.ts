import { describe, expect, it } from "vitest";
import { calculateCompletionKpis } from "@/features/dashboard/completion-metrics";
import { makeRecord } from "@/features/records/__fixtures__/record-row";

// 2026-11-08 is in Q4 (Oct-Dec); the Vietnam month is November.
const NOW = new Date("2026-11-08T10:00:00Z");
const completion = (partial: Parameters<typeof makeRecord>[0]) =>
  makeRecord({ certificateKind: "completion", validityMonths: null, expiryDate: null, daysToExpiry: null, expiryStatus: "No Expiry", ...partial });

describe("calculateCompletionKpis", () => {
  it("counts finished completions this month and this quarter, and the ones in progress", () => {
    const records = [
      completion({ id: "a", status: "done", issuedDate: "2026-11-02" }),
      completion({ id: "b", status: "done", issuedDate: "2026-10-15" }), // this quarter, not this month
      completion({ id: "c", status: "done", issuedDate: "2026-09-30" }), // previous quarter
      completion({ id: "d", status: "in_progress", progress: 40, issuedDate: null }),
      completion({ id: "e", status: "not_started", progress: 0, issuedDate: null }),
    ];
    expect(calculateCompletionKpis(records, NOW)).toEqual({ doneThisMonth: 1, doneThisQuarter: 2, doneTotal: 3, inProgress: 1 });
  });

  it("ignores exam certificates", () => {
    const records = [
      makeRecord({ id: "x", status: "done", issuedDate: "2026-11-02" }),
      makeRecord({ id: "y", status: "in_progress", issuedDate: null }),
    ];
    expect(calculateCompletionKpis(records, NOW)).toEqual({ doneThisMonth: 0, doneThisQuarter: 0, doneTotal: 0, inProgress: 0 });
  });

  it("does not leak into the next year when the quarter keys match", () => {
    const records = [completion({ status: "done", issuedDate: "2025-11-02" })];
    expect(calculateCompletionKpis(records, NOW).doneThisQuarter).toBe(0);
  });
});
