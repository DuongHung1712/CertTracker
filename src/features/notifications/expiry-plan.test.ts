import { describe, expect, it } from "vitest";
import {
  capItems,
  expiryBucket,
  isDeliverable,
  MAX_LINES,
  normalizeEmail,
  planExpiryAlerts,
} from "@/features/notifications/expiry-plan";
import type { Snapshot, SnapshotMember, SnapshotRecord, StaffUser } from "@/features/notifications/types";

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
  expiryDate: "2026-11-01",
  daysToExpiry: 25,
  expiryStatus: "Expiring Soon",
  ...over,
});
const manager = (userId: string, over: Partial<StaffUser> = {}): StaffUser => ({
  userId,
  email: `${userId}@x.test`,
  role: "manager",
  memberId: null,
  teamIds: ["t1"],
  ...over,
});
const snap = (over: Partial<Snapshot>): Snapshot => ({
  members: [],
  teams: [
    { id: "t1", name: "Team 1" },
    { id: "t2", name: "Team 2" },
  ],
  staff: [],
  records: [],
  ...over,
});

describe("planExpiryAlerts", () => {
  it("#10 a member with an Expiring Soon certificate gets one alert of their own", () => {
    const { alerts, undeliverable } = planExpiryAlerts(
      snap({ members: [member("a")], records: [record("r1", "a")] }),
    );
    expect(undeliverable).toEqual([]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.email).toBe("a@x.test");
    expect(alerts[0]?.name).toBe("Member a");
    expect(alerts[0]?.own).toHaveLength(1);
    expect(alerts[0]?.own[0]).toMatchObject({ recordId: "r1", bucket: "soon", daysToExpiry: 25 });
    expect(alerts[0]?.teams).toEqual([]);
  });

  it("#13 a record that is not done never produces an alert, whatever its numbers say", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("a")],
        records: [
          record("r1", "a", { status: "in_progress" }),
          record("r2", "a", { status: "not_started", expiryStatus: "Expired", daysToExpiry: -5 }),
        ],
      }),
    );
    expect(alerts).toEqual([]);
  });

  it("#14 No Expiry / N/A records (no days to expiry) are skipped", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("a")],
        records: [
          record("r1", "a", { expiryStatus: "No Expiry", daysToExpiry: null, expiryDate: null }),
          record("r2", "a", { expiryStatus: "N/A", daysToExpiry: null, expiryDate: null }),
        ],
      }),
    );
    expect(alerts).toEqual([]);
  });

  it("#15 an inactive member gets no alert and is missing from the manager's team section", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("gone", { isActive: false }), member("here")],
        staff: [manager("boss")],
        records: [record("r1", "gone"), record("r2", "here")],
      }),
    );
    expect(alerts.map((a) => a.email)).toEqual(["boss@x.test", "here@x.test"]);
    expect(alerts.find((a) => a.email === "gone@x.test")).toBeUndefined();
    const boss = alerts.find((a) => a.email === "boss@x.test");
    expect(boss?.teams).toHaveLength(1);
    expect(boss?.teams[0]?.items.map((i) => i.memberId)).toEqual(["here"]);
  });

  it("#16 a manager of two teams only gets a section for the team that has certificates", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("a", { teamId: "t1" }), member("b", { teamId: "t2", isActive: false })],
        staff: [manager("boss", { teamIds: ["t1", "t2"] })],
        records: [record("r1", "a"), record("r2", "b")],
      }),
    );
    const boss = alerts.find((a) => a.email === "boss@x.test");
    expect(boss?.teams).toHaveLength(1);
    expect(boss?.teams[0]).toMatchObject({ teamId: "t1", teamName: "Team 1" });
    expect(boss?.own).toEqual([]);
  });

  it("#17 a manager who is also a member gets ONE mail: own certificates + the others of the team, no duplicates", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("m1"), member("m2")],
        staff: [manager("boss", { email: "boss@corp.test", memberId: "m1" })],
        records: [record("r1", "m1"), record("r2", "m2")],
      }),
    );
    const toBoss = alerts.filter((a) => a.email === "boss@corp.test");
    expect(toBoss).toHaveLength(1);
    expect(toBoss[0]?.own.map((i) => i.recordId)).toEqual(["r1"]);
    expect(toBoss[0]?.teams).toHaveLength(1);
    expect(toBoss[0]?.teams[0]?.items.map((i) => i.recordId)).toEqual(["r2"]);
    // m1 must not get a second mail on the address stored in `members`.
    expect(alerts.filter((a) => a.email === "m1@x.test")).toEqual([]);
    // m2 still gets their own mail.
    expect(alerts.find((a) => a.email === "m2@x.test")?.own.map((i) => i.recordId)).toEqual(["r2"]);
    expect(alerts).toHaveLength(2);
  });

  it("#18 a manager is mailed on the login e-mail, linked to the member by id, not by e-mail equality", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("m1", { email: "m1@x.test" })],
        staff: [manager("boss", { email: "login@corp.test", memberId: "m1" })],
        records: [record("r1", "m1")],
      }),
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.email).toBe("login@corp.test");
    expect(alerts[0]?.own.map((i) => i.recordId)).toEqual(["r1"]);
    expect(alerts.find((a) => a.email === "m1@x.test")).toBeUndefined();
  });

  it("#19 a manager linked to an inactive member gets no mail at all, even if the team has certificates", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("m1", { isActive: false }), member("m2")],
        staff: [manager("boss", { email: "boss@corp.test", memberId: "m1" })],
        records: [record("r1", "m1"), record("r2", "m2")],
      }),
    );
    expect(alerts.find((a) => a.email === "boss@corp.test")).toBeUndefined();
    expect(alerts.map((a) => a.email)).toEqual(["m2@x.test"]);
  });

  it("#20 a manager with no teams, or whose teams have no certificates, gets nothing", () => {
    const base = { members: [member("a", { teamId: "t1" })], records: [record("r1", "a")] };
    // Certificates exist in both teams: an empty `teamIds` must mean "no teams", not "all teams".
    const noTeams = planExpiryAlerts(
      snap({
        members: [member("a", { teamId: "t1" }), member("b", { teamId: "t2" })],
        staff: [manager("boss", { teamIds: [] })],
        records: [record("r1", "a"), record("r2", "b")],
      }),
    );
    expect(noTeams.alerts.find((a) => a.email === "boss@x.test")).toBeUndefined();
    expect(noTeams.alerts.map((a) => a.email)).toEqual(["a@x.test", "b@x.test"]); // members still get their own mail
    const otherTeam = planExpiryAlerts(snap({ ...base, staff: [manager("boss", { teamIds: ["t2"] })] }));
    expect(otherTeam.alerts.map((a) => a.email)).toEqual(["a@x.test"]); // only the member's own mail
    const unknownTeam = planExpiryAlerts(snap({ ...base, staff: [manager("boss", { teamIds: ["ghost"] })] }));
    expect(unknownTeam.alerts.find((a) => a.email === "boss@x.test")).toBeUndefined();
    const teamWithoutCerts = planExpiryAlerts(
      snap({ members: [member("a")], staff: [manager("boss")], records: [] }),
    );
    expect(teamWithoutCerts.alerts).toEqual([]);
  });

  it("#21 an admin (even with stale teamIds) gets no team section, only own certificates", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("m1"), member("m2")],
        staff: [{ userId: "adm", email: "adm@corp.test", role: "admin", memberId: "m1", teamIds: ["t1"] }],
        records: [record("r1", "m1"), record("r2", "m2")],
      }),
    );
    const adm = alerts.find((a) => a.email === "adm@corp.test");
    expect(adm?.teams).toEqual([]);
    expect(adm?.own.map((i) => i.recordId)).toEqual(["r1"]);

    const withoutMember = planExpiryAlerts(
      snap({
        members: [member("m2")],
        staff: [{ userId: "adm", email: "adm@corp.test", role: "admin", memberId: null, teamIds: ["t1"] }],
        records: [record("r2", "m2")],
      }),
    );
    expect(withoutMember.alerts.find((a) => a.email === "adm@corp.test")).toBeUndefined();
  });

  it("#22 a plain member account (not in staff) is mailed on members.email", () => {
    const { alerts } = planExpiryAlerts(
      snap({ members: [member("a", { email: "a.real@x.test" })], staff: [], records: [record("r1", "a")] }),
    );
    expect(alerts.map((a) => a.email)).toEqual(["a.real@x.test"]);
  });

  it("#23 undeliverable addresses are reported, and addresses differing only by case are merged", () => {
    const { alerts, undeliverable } = planExpiryAlerts(
      snap({
        members: [
          member("a", { email: "" }),
          member("b", { email: "khong-co-a-cong" }),
          member("c", { email: "An@X.test" }),
          member("d", { email: "an@x.test" }),
        ],
        records: [record("r1", "a"), record("r2", "b"), record("r3", "c"), record("r4", "d")],
      }),
    );
    expect(undeliverable).toEqual(["", "khong-co-a-cong"]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.email).toBe("an@x.test");
    expect(alerts[0]?.own.map((i) => i.recordId).sort()).toEqual(["r3", "r4"]);
  });

  it("#23 isDeliverable / normalizeEmail", () => {
    expect(isDeliverable("a@b.co")).toBe(true);
    expect(isDeliverable("  a@b.co  ")).toBe(true);
    expect(isDeliverable("a@b")).toBe(false);
    expect(isDeliverable("a b@c.d")).toBe(false);
    expect(isDeliverable("")).toBe(false);
    expect(normalizeEmail("  An@X.test ")).toBe("an@x.test");
  });

  it("#23 an undeliverable address is reported once even if several members share it", () => {
    const { undeliverable } = planExpiryAlerts(
      snap({
        members: [member("a", { email: "bad" }), member("b", { email: "bad" })],
        records: [record("r1", "a"), record("r2", "b")],
      }),
    );
    expect(undeliverable).toEqual(["bad"]);
  });

  it("#24 a member without a team still gets their own alert; no manager sees that certificate", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("a", { teamId: null })],
        staff: [manager("boss", { teamIds: ["t1", "t2"] })],
        records: [record("r1", "a")],
      }),
    );
    expect(alerts.map((a) => a.email)).toEqual(["a@x.test"]);
    expect(alerts[0]?.own).toHaveLength(1);
    expect(alerts.find((a) => a.email === "boss@x.test")).toBeUndefined();
  });

  it("sorts items by urgency (expired first, ties by member name then course) and alerts by e-mail, deterministically", () => {
    const s = snap({
      members: [
        member("z", { fullName: "Zoe", email: "zoe@x.test" }),
        member("a", { fullName: "Ánh", email: "anh@x.test" }),
        member("e", { fullName: "Êm", email: "em@x.test" }),
      ],
      staff: [manager("boss", { email: "boss@x.test", teamIds: ["t1"] })],
      records: [
        record("r1", "z", { daysToExpiry: 10, courseName: "B" }),
        record("r2", "a", { daysToExpiry: 10, courseName: "B" }),
        record("r3", "z", { daysToExpiry: 10, courseName: "A" }),
        record("r4", "e", { daysToExpiry: -3, expiryStatus: "Expired", courseName: "X" }),
        record("r5", "a", { daysToExpiry: 40, expiryStatus: "Expiring in 60d", courseName: "Y" }),
        record("r6", "a", { daysToExpiry: 10, courseName: "A" }),
      ],
    });
    const first = planExpiryAlerts(s);
    const second = planExpiryAlerts(s);
    expect(second).toEqual(first);
    expect(first.alerts.map((a) => a.email)).toEqual(["anh@x.test", "boss@x.test", "em@x.test", "zoe@x.test"]);
    const boss = first.alerts.find((a) => a.email === "boss@x.test");
    // Ties at 10 days: Ánh before Zoe (Vietnamese collation), same member by course.
    expect(boss?.teams[0]?.items.map((i) => i.recordId)).toEqual(["r4", "r6", "r2", "r3", "r1", "r5"]);
  });

  it("breaks a full tie (same days, name and course) by member code, whatever the input order", () => {
    const build = (order: string[]) =>
      snap({
        members: [
          member("x", { fullName: "Same", code: "B-002", email: "x@x.test" }),
          member("y", { fullName: "Same", code: "A-001", email: "y@x.test" }),
        ],
        staff: [manager("boss")],
        records: order.map((id) => record(`r-${id}`, id, { courseName: "Same course", daysToExpiry: 7 })),
      });
    for (const order of [["x", "y"], ["y", "x"]]) {
      const boss = planExpiryAlerts(build(order)).alerts.find((a) => a.email === "boss@x.test");
      expect(boss?.teams[0]?.items.map((i) => i.memberCode)).toEqual(["A-001", "B-002"]);
    }
  });

  it("orders team sections by team name", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        teams: [
          { id: "t1", name: "Zeta" },
          { id: "t2", name: "Alpha" },
        ],
        members: [member("a", { teamId: "t1" }), member("b", { teamId: "t2" })],
        staff: [manager("boss", { teamIds: ["t1", "t2"] })],
        records: [record("r1", "a"), record("r2", "b")],
      }),
    );
    const boss = alerts.find((a) => a.email === "boss@x.test");
    expect(boss?.teams.map((t) => t.teamName)).toEqual(["Alpha", "Zeta"]);
  });

  it("returns no alerts (and no empty alerts) when there is nothing to report", () => {
    expect(planExpiryAlerts(snap({}))).toEqual({ alerts: [], undeliverable: [] });
    const quiet = planExpiryAlerts(
      snap({
        members: [member("a")],
        staff: [manager("boss")],
        records: [record("r1", "a", { expiryStatus: "Active", daysToExpiry: 200 })],
      }),
    );
    expect(quiet).toEqual({ alerts: [], undeliverable: [] });
  });

  it("does not mutate the snapshot it is given", () => {
    const s = snap({
      members: [member("a"), member("b")],
      staff: [manager("boss")],
      records: [record("r2", "b", { daysToExpiry: 20 }), record("r1", "a", { daysToExpiry: 5 })],
    });
    const copy = structuredClone(s);
    planExpiryAlerts(s);
    expect(s).toEqual(copy);
  });
});

describe("expiryBucket", () => {
  const rec = (expiryStatus: string, daysToExpiry: number | null, status: SnapshotRecord["status"] = "done") => ({
    status,
    expiryStatus,
    daysToExpiry,
  });

  it.each([
    ["Expiring Soon", 0, "soon"],
    ["Expiring Soon", 30, "soon"],
    ["Expiring in 60d", 31, "in60"],
    ["Expiring in 60d", 60, "in60"],
    ["Active", 61, null],
  ] as const)("#11 %s with %i days -> %s", (status, days, bucket) => {
    expect(expiryBucket(rec(status, days))).toBe(bucket);
  });

  it.each([
    [-1, "expired"],
    [-30, "expired"],
    [-31, null],
  ] as const)("#12 Expired with %i days -> %s", (days, bucket) => {
    expect(expiryBucket(rec("Expired", days))).toBe(bucket);
  });

  it("#13 only done records have a bucket", () => {
    expect(expiryBucket(rec("Expiring Soon", 25, "in_progress"))).toBeNull();
    expect(expiryBucket(rec("Expiring Soon", 25, "not_started"))).toBeNull();
  });

  it("#14 No Expiry / N/A have no bucket", () => {
    expect(expiryBucket(rec("No Expiry", null))).toBeNull();
    expect(expiryBucket(rec("N/A", null))).toBeNull();
  });

  it("#12 a recently expired certificate shows up in the alert as 'expired', a long-dead one does not", () => {
    const { alerts } = planExpiryAlerts(
      snap({
        members: [member("a")],
        records: [
          record("r1", "a", { expiryStatus: "Expired", daysToExpiry: -30 }),
          record("r2", "a", { expiryStatus: "Expired", daysToExpiry: -31 }),
        ],
      }),
    );
    expect(alerts[0]?.own.map((i) => [i.recordId, i.bucket])).toEqual([["r1", "expired"]]);
  });
});

describe("capItems", () => {
  it("#25 caps at MAX_LINES and reports how many are hidden", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const { shown, hidden } = capItems(items);
    expect(MAX_LINES).toBe(25);
    expect(shown).toHaveLength(MAX_LINES);
    expect(shown[0]).toBe(0);
    expect(shown[24]).toBe(24);
    expect(hidden).toBe(5);
  });
  it("#25 exactly at the limit hides nothing; empty is fine", () => {
    expect(capItems(Array.from({ length: 25 }, (_, i) => i)).hidden).toBe(0);
    expect(capItems(Array.from({ length: 26 }, (_, i) => i)).hidden).toBe(1);
    expect(capItems([], 25)).toEqual({ shown: [], hidden: 0 });
  });
  it("#25 honours a custom max", () => {
    expect(capItems([1, 2, 3], 2)).toEqual({ shown: [1, 2], hidden: 1 });
  });
});
