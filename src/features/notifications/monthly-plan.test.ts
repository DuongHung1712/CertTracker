import { describe, expect, it } from "vitest";
import { planMonthlyReports } from "@/features/notifications/monthly-plan";
import type { Snapshot, SnapshotMember, SnapshotRecord, StaffUser } from "@/features/notifications/types";

const MONTH = "2026-09";

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
  expiryDate: "2027-06-01",
  daysToExpiry: 200,
  expiryStatus: "Active",
  ...over,
});
const staffUser = (userId: string, role: StaffUser["role"], over: Partial<StaffUser> = {}): StaffUser => ({
  userId,
  email: `${userId}@x.test`,
  role,
  memberId: null,
  teamIds: [],
  ...over,
});
const admin = (userId = "adm", over: Partial<StaffUser> = {}) => staffUser(userId, "admin", over);
const manager = (userId = "boss", over: Partial<StaffUser> = {}) => staffUser(userId, "manager", { teamIds: ["t1"], ...over });
const snap = (over: Partial<Snapshot>): Snapshot => ({
  members: [],
  teams: [
    { id: "t1", name: "Team 1" },
    { id: "t2", name: "Team 2" },
    { id: "t3", name: "Team 3" },
  ],
  staff: [],
  records: [],
  ...over,
});

describe("planMonthlyReports scope", () => {
  const members = [
    member("m1", { teamId: "t1" }),
    member("m2", { teamId: "t2" }),
    member("m3", { teamId: null }),
    member("gone", { teamId: "t1", isActive: false }),
  ];
  const records = [
    record("r1", "m1"),
    record("r2", "m2", { status: "in_progress", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
    record("r3", "m3"),
    record("r4", "gone"),
    record("r5", "m2", { expiryStatus: "Expiring Soon", daysToExpiry: 12, expiryDate: "2026-10-16" }),
  ];

  it("#27 an admin gets an org-wide report with one row per team that has members, plus 'Chưa có team'", () => {
    const { reports, undeliverable } = planMonthlyReports(snap({ members, records, staff: [admin()] }), MONTH);
    expect(undeliverable).toEqual([]);
    expect(reports).toHaveLength(1);
    const r = reports[0]!;
    expect(r.scope).toBe("org");
    expect(r.email).toBe("adm@x.test");
    expect(r.month).toBe(MONTH);
    expect(r.overall.members).toBe(3); // the inactive member is not counted
    expect(r.overall.records).toBe(4);
    expect(r.teams.map((t) => [t.teamId, t.teamName, t.kpi.members])).toEqual([
      ["t1", "Team 1", 1],
      ["t2", "Team 2", 1],
      [null, "Chưa có team", 1],
    ]); // t3 has no active members: no row
  });

  it("#27 no 'Chưa có team' row when nobody lacks a team", () => {
    const { reports } = planMonthlyReports(
      snap({ members: [member("m1"), member("m2", { teamId: "t2" })], staff: [admin()] }),
      MONTH,
    );
    expect(reports[0]?.teams.map((t) => t.teamId)).toEqual(["t1", "t2"]);
  });

  it("#27 team rows are ordered by name, 'Chưa có team' last", () => {
    const { reports } = planMonthlyReports(
      snap({
        teams: [
          { id: "t1", name: "Zeta" },
          { id: "t2", name: "Ánh" },
        ],
        members: [member("m1", { teamId: "t1" }), member("m2", { teamId: "t2" }), member("m3", { teamId: null })],
        staff: [admin()],
      }),
      MONTH,
    );
    expect(reports[0]?.teams.map((t) => t.teamName)).toEqual(["Ánh", "Zeta", "Chưa có team"]);
  });

  it("#28 a manager only sees their teams: no scope, KPI or upcoming leak from other teams", () => {
    const { reports } = planMonthlyReports(snap({ members, records, staff: [manager()] }), MONTH);
    expect(reports).toHaveLength(1);
    const r = reports[0]!;
    expect(r.scope).toBe("teams");
    expect(r.teams.map((t) => t.teamId)).toEqual(["t1"]);
    expect(r.overall.members).toBe(1);
    expect(r.overall.records).toBe(1);
    expect(r.overall.done).toBe(1);
    expect(r.upcoming).toEqual([]); // r5 (Expiring Soon) belongs to team 2
  });

  it("#28 a manager of two teams gets both rows, ignoring unknown team ids and teams without active members", () => {
    const { reports } = planMonthlyReports(
      snap({ members, records, staff: [manager("boss", { teamIds: ["t2", "t1", "t3", "ghost"] })] }),
      MONTH,
    );
    const r = reports[0]!;
    expect(r.teams.map((t) => t.teamId)).toEqual(["t1", "t2"]);
    expect(r.overall.members).toBe(2);
    expect(r.overall.records).toBe(3);
  });

  it("#29 staff that are neither admin nor manager get no report", () => {
    const { reports } = planMonthlyReports(
      snap({
        members,
        records,
        staff: [staffUser("plain", "member", { teamIds: ["t1"] })],
      }),
      MONTH,
    );
    expect(reports).toEqual([]);
  });

  it("#29 a plain member account (not in staff) never gets a monthly report", () => {
    expect(planMonthlyReports(snap({ members, records, staff: [] }), MONTH)).toEqual({ reports: [], undeliverable: [] });
  });

  it("#33 a manager whose teams have no active members gets no report; neither does an admin of an empty org", () => {
    const onlyInactive = snap({ members: [member("gone", { isActive: false })], staff: [manager(), admin()] });
    expect(planMonthlyReports(onlyInactive, MONTH).reports).toEqual([]);

    const managerElsewhere = snap({ members: [member("m2", { teamId: "t2" })], staff: [manager()] });
    expect(planMonthlyReports(managerElsewhere, MONTH).reports).toEqual([]);

    const noMembers = snap({ staff: [admin()] });
    expect(planMonthlyReports(noMembers, MONTH)).toEqual({ reports: [], undeliverable: [] });
  });

  it("a staff account linked to an inactive member is skipped, one linked to an active member is named after them", () => {
    const { reports } = planMonthlyReports(
      snap({
        members: [member("m1"), member("gone", { isActive: false })],
        staff: [
          admin("adm", { memberId: "gone" }),
          manager("boss", { memberId: "m1" }),
          manager("carl", { memberId: null }),
        ],
      }),
      MONTH,
    );
    expect(reports.map((r) => [r.email, r.name])).toEqual([
      ["boss@x.test", "Member m1"],
      ["carl@x.test", null],
    ]);
  });
});

describe("planMonthlyReports KPIs", () => {
  const kpiOf = (records: SnapshotRecord[], members: SnapshotMember[] = [member("a")]) => {
    const { reports } = planMonthlyReports(snap({ members, records, staff: [admin()] }), MONTH);
    return reports[0]!.overall;
  };

  it("#34 counts valid / expiring / expired / done / in progress / not started (same definitions as Dashboard decisions #30-#31)", () => {
    const k = kpiOf([
      record("r1", "a"), // done, Active
      record("r2", "a", { expiryStatus: "Expiring in 60d", daysToExpiry: 45 }), // done, 60d
      record("r3", "a", { expiryStatus: "Expiring Soon", daysToExpiry: 10 }), // done, soon
      record("r4", "a", { expiryStatus: "Expired", daysToExpiry: -40, expiryDate: "2026-08-25" }), // done, expired
      record("r5", "a", { expiryStatus: "No Expiry", daysToExpiry: null, expiryDate: null }), // done, no expiry
      record("r6", "a", { status: "in_progress", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
      record("r7", "a", { status: "not_started", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
      record("r8", "a", { status: "in_progress", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
      record("r9", "a"), // done, Active
      record("r10", "a", { status: "not_started", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
    ]);
    expect(k).toMatchObject({
      members: 1,
      records: 10,
      done: 6,
      inProgress: 2,
      notStarted: 2,
      valid: 5, // done and not expired, No Expiry included
      expiring: 2, // Expiring Soon + Expiring in 60d, a subset of valid
      expired: 1,
      completionRate: 60,
    });
  });

  it("#30 issuedInMonth is inclusive on both ends of the month and exclusive just outside", () => {
    const k = kpiOf([
      record("r1", "a", { issuedDate: "2026-09-01" }),
      record("r2", "a", { issuedDate: "2026-09-30" }),
      record("r3", "a", { issuedDate: "2026-08-31" }),
      record("r4", "a", { issuedDate: "2026-10-01" }),
      record("r5", "a", { issuedDate: null }),
    ]);
    expect(k.issuedInMonth).toBe(2);
  });

  it("#30 only done records count as issued in the month", () => {
    const k = kpiOf([record("r1", "a", { status: "in_progress", issuedDate: "2026-09-10", expiryStatus: "N/A" })]);
    expect(k.issuedInMonth).toBe(0);
  });

  it("#31 expiredInMonth counts only certificates that are still Expired with their expiry date in the month", () => {
    const k = kpiOf([
      record("r1", "a", { expiryStatus: "Expired", expiryDate: "2026-09-15", daysToExpiry: -16 }),
      // renewed: the new expiry date is outside the month and the status is Active again
      record("r2", "a", { expiryStatus: "Active", expiryDate: "2027-09-15", daysToExpiry: 300 }),
      // defensive: a date inside the month but not Expired must not count
      record("r3", "a", { expiryStatus: "Active", expiryDate: "2026-09-15", daysToExpiry: 200 }),
      // expired in another month
      record("r4", "a", { expiryStatus: "Expired", expiryDate: "2026-08-31", daysToExpiry: -31 }),
      record("r5", "a", { expiryStatus: "Expired", expiryDate: "2026-09-01", daysToExpiry: -30 }),
      record("r6", "a", { expiryStatus: "Expired", expiryDate: "2026-09-30", daysToExpiry: -1 }),
      record("r7", "a", { expiryStatus: "Expired", expiryDate: "2026-10-01", daysToExpiry: -1 }),
    ]);
    expect(k.expiredInMonth).toBe(3);
  });

  it("#32 completion rate is null with no records, rounds down (29/100 is 29), and is 100 only when all are done", () => {
    expect(kpiOf([]).completionRate).toBeNull();

    const many = (done: number, total: number) =>
      Array.from({ length: total }, (_, i) =>
        record(`r${i}`, "a", i < done ? {} : { status: "in_progress", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
      );
    expect(kpiOf(many(29, 100)).completionRate).toBe(29);
    expect(kpiOf(many(99, 100)).completionRate).toBe(99);
    expect(kpiOf(many(100, 100)).completionRate).toBe(100);
    expect(kpiOf(many(2, 3)).completionRate).toBe(66);
  });

  it("an inactive member is excluded from members and from every count", () => {
    const k = kpiOf(
      [
        record("r1", "a"),
        record("r2", "gone", { issuedDate: "2026-09-10", expiryStatus: "Expired", expiryDate: "2026-09-12", daysToExpiry: -20 }),
      ],
      [member("a"), member("gone", { isActive: false })],
    );
    expect(k).toMatchObject({ members: 1, records: 1, done: 1, expired: 0, issuedInMonth: 0, expiredInMonth: 0 });
  });

  it("per-team rows carry their own KPI while overall covers the whole scope", () => {
    const { reports } = planMonthlyReports(
      snap({
        members: [member("a", { teamId: "t1" }), member("b", { teamId: "t2" })],
        records: [
          record("r1", "a"),
          record("r2", "b", { status: "in_progress", issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A" }),
        ],
        staff: [admin()],
      }),
      MONTH,
    );
    const r = reports[0]!;
    expect(r.overall).toMatchObject({ members: 2, records: 2, done: 1, completionRate: 50 });
    expect(r.teams.map((t) => [t.teamName, t.kpi.records, t.kpi.completionRate])).toEqual([
      ["Team 1", 1, 100],
      ["Team 2", 1, 0],
    ]);
  });
});

describe("planMonthlyReports upcoming", () => {
  const members = [member("a", { teamId: "t1", fullName: "Ánh" }), member("b", { teamId: "t2", fullName: "Bình" })];
  const records = [
    record("r1", "a", { expiryStatus: "Expiring in 60d", daysToExpiry: 50, expiryDate: "2026-11-20" }),
    record("r2", "a", { expiryStatus: "Expiring Soon", daysToExpiry: 5, expiryDate: "2026-10-10" }),
    record("r3", "a", { expiryStatus: "Expired", daysToExpiry: -3, expiryDate: "2026-10-02" }),
    record("r4", "b", { expiryStatus: "Expiring Soon", daysToExpiry: 5, expiryDate: "2026-10-10" }),
    record("r5", "b", { expiryStatus: "Expiring Soon", daysToExpiry: 20, expiryDate: "2026-10-25" }),
    record("r6", "a", { expiryStatus: "Active", daysToExpiry: 100 }),
    record("r7", "a", { status: "in_progress", expiryStatus: "Expiring Soon", daysToExpiry: 3 }),
  ];

  it("lists only Expiring Soon + Expiring in 60d (never Expired), most urgent first, ties by member name", () => {
    const { reports } = planMonthlyReports(snap({ members, records, staff: [admin()] }), MONTH);
    expect(reports[0]?.upcoming.map((i) => i.recordId)).toEqual(["r2", "r4", "r5", "r1"]);
    expect(reports[0]?.upcoming.every((i) => i.bucket !== "expired")).toBe(true);
  });

  it("a manager only sees the upcoming certificates of their own teams", () => {
    const { reports } = planMonthlyReports(snap({ members, records, staff: [manager()] }), MONTH);
    expect(reports[0]?.upcoming.map((i) => i.recordId)).toEqual(["r2", "r1"]);
  });

  it("leaves out inactive members", () => {
    const { reports } = planMonthlyReports(
      snap({
        members: [member("a"), member("b", { isActive: false })],
        records: [record("r1", "a", { expiryStatus: "Expiring Soon", daysToExpiry: 9 }), record("r2", "b", { expiryStatus: "Expiring Soon", daysToExpiry: 1 })],
        staff: [admin()],
      }),
      MONTH,
    );
    expect(reports[0]?.upcoming.map((i) => i.recordId)).toEqual(["r1"]);
  });
});

describe("planMonthlyReports delivery", () => {
  const base = { members: [member("a")], records: [record("r1", "a")] };

  it("reports undeliverable e-mails instead of producing a report", () => {
    const { reports, undeliverable } = planMonthlyReports(
      snap({
        ...base,
        staff: [admin("bad", { email: "khong-co-a-cong" }), admin("empty", { email: "" }), admin("ok", { email: "ok@x.test" })],
      }),
      MONTH,
    );
    expect(reports.map((r) => r.email)).toEqual(["ok@x.test"]);
    expect(undeliverable).toEqual(["", "khong-co-a-cong"]);
  });

  it("dedupes by normalised e-mail and keeps the broadest scope (org over teams)", () => {
    const { reports } = planMonthlyReports(
      snap({
        ...base,
        staff: [manager("boss", { email: "Boss@X.test" }), admin("adm", { email: "boss@x.test" })],
      }),
      MONTH,
    );
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ email: "boss@x.test", scope: "org" });
  });

  it("orders reports by e-mail, deterministically, without mutating the snapshot", () => {
    const s = snap({
      ...base,
      staff: [admin("zed", { email: "zed@x.test" }), manager("amy", { email: "amy@x.test" }), admin("kim", { email: "kim@x.test" })],
    });
    const copy = structuredClone(s);
    const first = planMonthlyReports(s, MONTH);
    expect(first.reports.map((r) => r.email)).toEqual(["amy@x.test", "kim@x.test", "zed@x.test"]);
    expect(planMonthlyReports(s, MONTH)).toEqual(first);
    expect(s).toEqual(copy);
  });

  it("rejects an impossible month instead of silently reporting on nothing", () => {
    expect(() => planMonthlyReports(snap({ ...base, staff: [admin()] }), "2026-13")).toThrow();
  });
});
