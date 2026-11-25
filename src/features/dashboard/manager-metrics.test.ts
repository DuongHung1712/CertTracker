import { describe, expect, it } from "vitest";
import {
  calculateManagerKpis,
  formatManagerSubtitle,
  getManagerAttention,
  getMembersWithoutCerts,
  getNeedsAttentionItems,
  getNextToExpire,
  getPlannedExams,
  getTeamReadinessLeague,
  isDone,
  isExpired,
  isExpiring60,
} from "@/features/dashboard/manager-metrics";
import { doneRecord, makeRecord } from "@/features/records/__fixtures__/record-row";

describe("manager-metrics", () => {
  describe("formatManagerSubtitle", () => {
    it("formats subtitle correctly with member pluralization", () => {
      expect(formatManagerSubtitle([], 0)).toBe("No teams assigned yet.");
      expect(formatManagerSubtitle(["Team Cloud"], 1)).toBe("You look after Team Cloud (1 member).");
      expect(formatManagerSubtitle(["Team Cloud"], 2)).toBe("You look after Team Cloud (2 members).");
      expect(formatManagerSubtitle(["Team Cloud", "Team AI"], 14)).toBe("You look after Team Cloud and Team AI (14 members).");
      expect(formatManagerSubtitle(["Team Cloud", "Team AI", "Team Data"], 3)).toBe(
        "You look after Team Cloud, Team AI and Team Data (3 members).",
      );
    });
  });

  describe("predicate status helpers", () => {
    it("identifies done, expiring60 and expired", () => {
      const active = doneRecord(100);
      const exp60 = doneRecord(45);
      const expired = doneRecord(-5);

      expect(isDone(active)).toBe(true);

      expect(isExpiring60(exp60)).toBe(true);
      expect(isExpiring60(doneRecord(20))).toBe(true);
      expect(isExpiring60(active)).toBe(false);
      expect(isExpiring60(expired)).toBe(false);

      expect(isExpired(expired)).toBe(true);
      expect(isExpired(active)).toBe(false);

    });
  });

  describe("calculateManagerKpis", () => {
    it("handles empty record list", () => {
      const kpis = calculateManagerKpis([]);
      expect(kpis.totalCertificates).toBe(0);
      expect(kpis.doneCount).toBe(0);
      expect(kpis.validCount).toBe(0);
      expect(kpis.expiringCount).toBe(0);
      expect(kpis.expiredCount).toBe(0);
      expect(kpis.inProgressCount).toBe(0);
      expect(kpis.notStartedCount).toBe(0);
      expect(kpis.teamReadinessRate).toBe(0);
      expect(kpis.teamReadinessFormatted).toBe("0%");
      expect(kpis.urgentCount).toBe(0);
    });

    it("counts completed certificates with 30 days or less left as urgentCount (boundaries -1, 0, 30, 31)", () => {
      const kpis = calculateManagerKpis([doneRecord(-1), doneRecord(0), doneRecord(30), doneRecord(31), doneRecord(60)]);
      expect(kpis.urgentCount).toBe(2);
      expect(kpis.expiringCount).toBe(4);
    });

    it("calculates rates and breakdown accurately", () => {
      const records = [
        doneRecord(90), // valid
        doneRecord(25), // valid + expiring60 + expiring30
        doneRecord(-10), // expired
        makeRecord({ status: "in_progress" }),
        makeRecord({ status: "not_started" }),
      ];

      const kpis = calculateManagerKpis(records);
      expect(kpis.totalCertificates).toBe(5);
      expect(kpis.doneCount).toBe(3);
      expect(kpis.validCount).toBe(2);
      expect(kpis.expiringCount).toBe(1);
      expect(kpis.expiredCount).toBe(1);
      expect(kpis.inProgressCount).toBe(1);
      expect(kpis.notStartedCount).toBe(1);
      // validCount (2) / doneCount (3) = 66.66% -> 66% (integer floor)
      expect(kpis.teamReadinessRate).toBe(66);
      expect(kpis.teamReadinessFormatted).toBe("66%");
    });

    it("calculates 100% readiness when all completed are valid", () => {
      const records = [doneRecord(25), makeRecord({ status: "not_started" })];
      const kpis = calculateManagerKpis(records);
      expect(kpis.totalCertificates).toBe(2);
      expect(kpis.doneCount).toBe(1);
      expect(kpis.validCount).toBe(1);
      expect(kpis.teamReadinessRate).toBe(100);
      expect(kpis.teamReadinessFormatted).toBe("100%");
    });
  });

  describe("getNextToExpire", () => {
    it("returns completed certificates expiring within 60 days sorted soonest first", () => {
      const r1 = doneRecord(45, { id: "r1", memberName: "B" });
      const r2 = doneRecord(10, { id: "r2", memberName: "A" });
      const r3 = doneRecord(10, { id: "r3", memberName: "C" });
      const r4 = doneRecord(120, { id: "r4" }); // outside 60d
      const r5 = doneRecord(-2, { id: "r5" }); // expired

      const result = getNextToExpire([r1, r2, r3, r4, r5]);
      expect(result.map((r) => r.id)).toEqual(["r2", "r3", "r1"]);
    });

    it("respects limit parameter", () => {
      const records = Array.from({ length: 15 }, (_, i) => doneRecord(i + 1, { id: `r-${i}` }));
      expect(getNextToExpire(records, 5)).toHaveLength(5);
    });
  });

  describe("getTeamReadinessLeague", () => {
    it("calculates member metrics and sorts by valid certificates then in_progress", () => {
      const members = [
        { id: "m1", fullName: "Nguyễn Văn An", teamName: "Team Cloud" },
        { id: "m2", fullName: "Lê Minh Châu", teamName: "Team Cloud" },
        { id: "m3", fullName: "Trần Thị Bình", teamName: "Team AI" },
      ];

      const records = [
        doneRecord(100, { memberId: "m1" }),
        doneRecord(20, { memberId: "m1" }),
        doneRecord(50, { memberId: "m2" }),
        makeRecord({ memberId: "m2", status: "in_progress" }),
        makeRecord({ memberId: "m3", status: "not_started" }),
      ];

      const league = getTeamReadinessLeague(members, records);
      expect(league).toHaveLength(3);
      expect(league[0].memberName).toBe("Nguyễn Văn An");
      expect(league[0].validCount).toBe(2);
      expect(league[1].memberName).toBe("Lê Minh Châu");
      expect(league[1].validCount).toBe(1);
      expect(league[1].inProgressCount).toBe(1);
      expect(league[2].memberName).toBe("Trần Thị Bình");
      expect(league[2].validCount).toBe(0);
    });
  });


  describe("getPlannedExams", () => {
    it("returns upcoming planned exams within the next 60 days sorted by days remaining", () => {
      const now = new Date("2026-11-08T00:00:00Z");
      const records = [
        makeRecord({ status: "in_progress", id: "r1", memberName: "An", plannedExamDate: "2026-11-20" }), // 12 days
        makeRecord({ status: "in_progress", id: "r2", memberName: "Bình", plannedExamDate: "2026-11-10" }), // 2 days
        makeRecord({ status: "in_progress", id: "r3", memberName: "Châu", plannedExamDate: "2027-02-15" }), // > 60 days
        makeRecord({ status: "in_progress", id: "r4", memberName: "Dung", plannedExamDate: "2026-11-01" }), // past exam
        makeRecord({ id: "r5", memberName: "Giang", plannedExamDate: "2026-11-12" }), // already completed
      ];

      const exams = getPlannedExams(records, 60, now);
      expect(exams).toHaveLength(2);
      expect(exams[0].memberName).toBe("Bình");
      expect(exams[0].daysRemaining).toBe(2);
      expect(exams[1].memberName).toBe("An");
      expect(exams[1].daysRemaining).toBe(12);
    });
  });

  describe("getNeedsAttentionItems", () => {
    it("lists only expired certificates, most overdue first (upcoming ones belong to Next to expire)", () => {
      const exp1 = doneRecord(-5, { id: "e1", memberName: "Minh", certificateName: "PMP" });
      const exp2 = doneRecord(-1, { id: "e2", memberName: "Tuan", certificateName: "CKA" });
      const soon1 = doneRecord(12, { id: "s1", memberName: "Linh", certificateName: "AWS SAA" });
      const today = doneRecord(0, { id: "s0", memberName: "Hoa", certificateName: "GCP" });
      const later = doneRecord(50, { id: "l1", memberName: "An", certificateName: "Terraform" });

      const items = getNeedsAttentionItems([later, soon1, today, exp2, exp1]);
      expect(items.map((i) => i.record.id)).toEqual(["e1", "e2"]);
      expect(items[0].description).toContain("expired 5 days ago");
      expect(items[1].description).toContain("expired 1 day ago");
    });

    it("never lists a certificate that Next to expire lists (one expired, one 20-day, one 45-day)", () => {
      const records = [
        doneRecord(-3, { id: "expired" }),
        doneRecord(20, { id: "in-20" }),
        doneRecord(45, { id: "in-45" }),
      ];
      const attention = getNeedsAttentionItems(records).map((i) => i.record.id);
      const next = getNextToExpire(records).map((r) => r.id);
      expect(attention).toEqual(["expired"]);
      expect(next).toEqual(["in-20", "in-45"]);
      expect(attention.filter((id) => next.includes(id))).toEqual([]);
    });
  });

  describe("getMembersWithoutCerts", () => {
    it("filters members who do not have any completed certificate", () => {
      const members = [
        { id: "m1", fullName: "Nguyễn Văn An", teamName: "Cloud" },
        { id: "m2", fullName: "Lê Minh Châu", teamName: "Cloud" },
        { id: "m3", fullName: "Trần Thị Bình", teamName: "AI" },
      ];
      const records = [
        doneRecord(30, { memberId: "m1" }),
        makeRecord({ memberId: "m2", status: "not_started" }),
      ];

      const noCerts = getMembersWithoutCerts(members, records);
      expect(noCerts).toHaveLength(2);
      expect(noCerts.map((m) => m.fullName)).toEqual(["Lê Minh Châu", "Trần Thị Bình"]);
    });

    it("does not count a done course completion as having a certificate", () => {
      const members = [{ id: "m1", fullName: "An", teamName: "Cloud" }];
      const records = [makeRecord({ memberId: "m1", status: "done", certificateKind: "completion" })];
      expect(getMembersWithoutCerts(members, records)).toHaveLength(1);
    });
  });
});

describe("manager-metrics: exam certificates only", () => {
  const completion = (partial: Parameters<typeof makeRecord>[0]) =>
    makeRecord({ certificateKind: "completion", validityMonths: null, expiryDate: null, daysToExpiry: null, expiryStatus: "No Expiry", ...partial });

  it("leaves course completions out of the exam KPIs", () => {
    const kpis = calculateManagerKpis([
      doneRecord(20),
      doneRecord(-5),
      completion({ id: "c1", status: "done" }),
      completion({ id: "c2", status: "in_progress", progress: 30, issuedDate: null }),
    ]);
    expect(kpis).toMatchObject({ doneCount: 2, validCount: 1, expiringCount: 1, expiredCount: 1, inProgressCount: 0 });
    expect(kpis.totalCertificates).toBe(2);
  });

  it("counts planned exams in the next 60 days and ignores a planned finish date", () => {
    const now = new Date("2026-11-08T10:00:00Z");
    const records = [
      makeRecord({ id: "e", status: "in_progress", plannedExamDate: "2026-11-20" }),
      completion({ id: "c", status: "in_progress", plannedExamDate: "2026-11-20" }),
    ];
    expect(getPlannedExams(records, 60, now).map((p) => p.recordId)).toEqual(["e"]);
  });
});

describe("manager-metrics: a completion with a validity stays out of expiry lists", () => {
  const completion = (id: string, days: number) =>
    doneRecord(days, { id, certificateKind: "completion", validityMonths: 12 });

  it("is neither expiring nor expired, and is in neither list", () => {
    const records = [completion("c-exp", -5), completion("c-soon", 20)];
    expect(records.some(isExpired)).toBe(false);
    expect(records.some(isExpiring60)).toBe(false);
    expect(getNextToExpire(records)).toEqual([]);
    expect(getNeedsAttentionItems(records)).toEqual([]);
  });
});

describe("manager-metrics: only Approved certificates count", () => {
  const waiting = { approval: "waiting" } as const;
  const returned = { approval: "returned", approvalNote: "Wrong date" } as const;
  const records = [
    doneRecord(120, { id: "ok", memberId: "m1" }),
    doneRecord(-5, { id: "w-exp", memberId: "m1", ...waiting }),
    doneRecord(20, { id: "r-soon", memberId: "m1", ...returned }),
    makeRecord({ id: "todo", memberId: "m1", status: "not_started", expiryStatus: "N/A", daysToExpiry: null }),
  ];

  it("calculateManagerKpis ignores Waiting and Returned items everywhere, total included", () => {
    expect(calculateManagerKpis(records)).toMatchObject({
      totalCertificates: 2, doneCount: 1, validCount: 1, expiredCount: 0, expiringCount: 0, notStartedCount: 1,
    });
  });
  it("the expiry predicates, next-to-expire and attention lists skip them", () => {
    expect(isDone(records[1])).toBe(false);
    expect(isExpired(records[1])).toBe(false);
    expect(isExpiring60(records[2])).toBe(false);
    expect(getNextToExpire(records).map((r) => r.id)).toEqual([]);
    expect(getNeedsAttentionItems(records)).toEqual([]);
  });
  it("the league counts only Approved items and so do members without certs", () => {
    const league = getTeamReadinessLeague([{ id: "m1", fullName: "An", teamName: "Cloud" }], records);
    expect(league[0]).toMatchObject({ validCount: 1, expiredCount: 0, totalCount: 2 });
    expect(getMembersWithoutCerts([{ id: "m1", fullName: "An", teamName: null }], [records[1]])).toHaveLength(1);
  });
});

describe("getManagerAttention", () => {
  const members = [
    { id: "m1", fullName: "An", teamName: "Cloud" },
    { id: "m2", fullName: "Binh", teamName: "Cloud" },
    { id: "m3", fullName: "Chau", teamName: "AI" },
  ];

  it("puts expired first (most overdue first), then expiring (soonest first), then exams, then people with no certificate", () => {
    const records = [
      doneRecord(20, { id: "soon", memberId: "m1", memberName: "An", certificateName: "AWS" }),
      doneRecord(-9, { id: "old", memberId: "m2", memberName: "Binh", certificateName: "CKA" }),
      doneRecord(-2, { id: "new", memberId: "m2", memberName: "Binh", certificateName: "PMP" }),
      makeRecord({ id: "exam", memberId: "m3", memberName: "Chau", status: "not_started", plannedExamDate: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10), expiryStatus: "N/A", daysToExpiry: null, certificateName: "GCP" }),
    ];
    const { items, total } = getManagerAttention(records, members, 10);
    expect(items.map((i) => i.id)).toEqual(["expired:old", "expired:new", "expiring:soon", "exam:exam", "none:m3"]);
    expect(total).toBe(5);
    expect(items[0]).toMatchObject({ title: "Binh · CKA", detail: "Expired 9 days ago", href: "/records?search=Binh%20M001%20CKA" });
    expect(items[2].detail).toBe("20 days left");
    expect(items[3].href).toBe("/records?tab=learning&search=Chau"); // a planned exam lives on the Learning tab
    expect(items[4]).toMatchObject({ title: "Chau", detail: "No certificate yet", teamName: "AI" });
  });

  it("shows the first few and still counts all of them", () => {
    const records = Array.from({ length: 8 }, (_, i) => doneRecord(-(i + 1), { id: `e${i}`, memberId: "m1", memberName: "An" }));
    const { items, total } = getManagerAttention(records, [{ id: "m1", fullName: "An", teamName: null }], 6);
    expect(items).toHaveLength(6);
    expect(total).toBe(8);
  });

  it("is empty when everyone is fine", () => {
    const records = [doneRecord(200, { id: "ok", memberId: "m1", memberName: "An" })];
    expect(getManagerAttention(records, [{ id: "m1", fullName: "An", teamName: null }])).toEqual({ items: [], total: 0 });
  });

  it("encodes a name with spaces and symbols in the link", () => {
    const { items } = getManagerAttention([], [{ id: "m9", fullName: "Lê Minh & Co", teamName: null }]);
    expect(items[0].href).toBe("/records?tab=learning&search=L%C3%AA%20Minh%20%26%20Co");
  });
});
