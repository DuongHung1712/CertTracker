import { describe, expect, it } from "vitest";
import { runExpiryAlerts, runMonthlyReport, type RunDeps } from "@/features/notifications/run";
import { FakeLedger, FakeSender } from "@/features/notifications/test-doubles";
import type { Snapshot, SnapshotMember, SnapshotRecord, StaffUser } from "@/features/notifications/types";
import { todayVn } from "@/lib/dates";

const member = (id: string, over: Partial<SnapshotMember> = {}): SnapshotMember => ({
  id,
  code: `M${id}`,
  fullName: `Member ${id}`,
  email: `${id}@x.test`,
  teamId: "t1",
  isActive: true,
  ...over,
});
const record = (id: string, memberId: string, over: Partial<SnapshotRecord> = {}): SnapshotRecord => ({
  id,
  memberId,
  status: "done",
  courseName: `Course ${id}`,
  issuedDate: "2026-01-01",
  expiryDate: "2026-10-20",
  daysToExpiry: 15,
  expiryStatus: "Expiring Soon",
  ...over,
});
const staff = (userId: string, role: StaffUser["role"], over: Partial<StaffUser> = {}): StaffUser => ({
  userId,
  email: `${userId}@x.test`,
  role,
  memberId: null,
  teamIds: [],
  ...over,
});
const snapshot = (over: Partial<Snapshot> = {}): Snapshot => ({
  members: [member("a")],
  teams: [{ id: "t1", name: "Cloud" }],
  staff: [staff("boss", "manager", { teamIds: ["t1"] })],
  records: [record("r1", "a")],
  ...over,
});

const deps = (over: Partial<RunDeps> = {}) => {
  const ledger = new FakeLedger();
  const sender = new FakeSender("console");
  const all: RunDeps = {
    snapshot: snapshot(),
    today: "2026-10-05",
    appUrl: "https://app.example.test",
    ledger,
    sender,
    dryRun: false,
    now: () => 0,
    deadlineMs: Number.MAX_SAFE_INTEGER,
    ...over,
  };
  return { ledger, sender, all };
};

describe("runExpiryAlerts", () => {
  it("sends one mail to the member and one to their manager for the ISO week", async () => {
    const { ledger, sender, all } = deps();
    const summary = await runExpiryAlerts(all);
    expect(summary).toMatchObject({
      job: "expiry-alert",
      period: "2026-W41",
      transport: "console",
      dryRun: false,
      planned: 2,
      sent: 2,
      skipped: 0,
      failed: 0,
      truncated: false,
    });
    expect(sender.sent.map((m) => m.to).sort()).toEqual(["a@x.test", "boss@x.test"]);
    expect(ledger.all.every((r) => r.kind === "expiry-alert" && r.period === "2026-W41" && r.status === "sent")).toBe(true);
  });

  it("takes the transport from the sender", async () => {
    const { all } = deps({ sender: new FakeSender("resend"), dryRun: true });
    expect((await runExpiryAlerts(all)).transport).toBe("resend");
  });

  it("describes recipients in a dry run without touching the ledger or the sender (edge #50)", async () => {
    const { ledger, sender, all } = deps({ dryRun: true });
    const summary = await runExpiryAlerts(all);
    expect(summary).toMatchObject({ dryRun: true, planned: 2, sent: 0 });
    expect(summary.recipients).toEqual([
      { email: "a@x.test", detail: { own: 1, teams: 0, teamItems: 0 } },
      { email: "boss@x.test", detail: { own: 0, teams: 1, teamItems: 1 } },
    ]);
    expect(ledger.calls).toEqual({ claim: 0, markSent: 0, markFailed: 0 });
    expect(sender.sent).toHaveLength(0);
  });

  it("passes undeliverable addresses from the planner into the summary", async () => {
    const { all } = deps({
      snapshot: snapshot({ members: [member("a"), member("b", { email: "not-an-address" })], records: [record("r1", "a"), record("r2", "b")] }),
    });
    const summary = await runExpiryAlerts(all);
    expect(summary.undeliverable).toEqual(["not-an-address"]);
  });

  it("plans nothing when no certificate needs attention: no sender call, no log row (edge #37)", async () => {
    const { ledger, sender, all } = deps({ snapshot: snapshot({ records: [record("r1", "a", { expiryStatus: "Active", daysToExpiry: 200 })] }) });
    const summary = await runExpiryAlerts(all);
    expect(summary).toMatchObject({ planned: 0, sent: 0, skipped: 0, failed: 0 });
    expect(sender.sent).toHaveLength(0);
    expect(ledger.all).toHaveLength(0);
    expect(ledger.calls.claim).toBe(0);
  });

  it("is idempotent within the same ISO week", async () => {
    const { sender, all } = deps();
    await runExpiryAlerts(all);
    sender.sent = [];
    const again = await runExpiryAlerts({ ...all, today: "2026-10-09" }); // same week, Friday
    expect(again).toMatchObject({ sent: 0, skipped: 2 });
    expect(sender.sent).toHaveLength(0);
  });
});

describe("runMonthlyReport", () => {
  const monthly = snapshot({ staff: [staff("adm", "admin"), staff("boss", "manager", { teamIds: ["t1"] })] });

  it("reports the previous month to every admin and manager with data", async () => {
    const { sender, all } = deps({ snapshot: monthly, today: "2026-10-01" });
    const summary = await runMonthlyReport(all);
    expect(summary).toMatchObject({ job: "monthly-report", period: "2026-09", planned: 2, sent: 2, failed: 0, transport: "console" });
    expect(sender.sent.map((m) => m.to).sort()).toEqual(["adm@x.test", "boss@x.test"]);
    expect(sender.sent.every((m) => m.subject.includes("tháng 09/2026"))).toBe(true);
    expect(sender.sent.map((m) => m.idempotencyKey).sort()).toEqual([
      "monthly-report:2026-09:adm@x.test",
      "monthly-report:2026-09:boss@x.test",
    ]);
  });

  it("uses the Vietnamese date, so 18:00Z on the 30th is already 1 October and reports September (edge #8)", async () => {
    const today = todayVn(new Date("2026-09-30T18:00:00Z"));
    expect(today).toBe("2026-10-01");
    const { all } = deps({ snapshot: monthly, today, dryRun: true });
    expect((await runMonthlyReport(all)).period).toBe("2026-09");
  });

  it("does not send a second report for the same month", async () => {
    const { sender, all } = deps({ snapshot: monthly, today: "2026-10-01" });
    await runMonthlyReport(all);
    sender.sent = [];
    const again = await runMonthlyReport({ ...all, today: "2026-10-20" });
    expect(again).toMatchObject({ sent: 0, skipped: 2 });
    expect(sender.sent).toHaveLength(0);
  });

  it("passes undeliverable staff addresses into the summary", async () => {
    const { all } = deps({
      snapshot: snapshot({ staff: [staff("adm", "admin", { email: "broken" })] }),
      today: "2026-10-01",
      dryRun: true,
    });
    const summary = await runMonthlyReport(all);
    expect(summary.undeliverable).toEqual(["broken"]);
    expect(summary.planned).toBe(0);
  });

  it("plans nothing without staff: no sender call, no log row (edge #37)", async () => {
    const { ledger, sender, all } = deps({ snapshot: snapshot({ staff: [] }), today: "2026-10-01" });
    const summary = await runMonthlyReport(all);
    expect(summary.planned).toBe(0);
    expect(sender.sent).toHaveLength(0);
    expect(ledger.all).toHaveLength(0);
  });
});
