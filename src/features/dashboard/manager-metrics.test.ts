import { describe, expect, it } from "vitest";
import {
  calculateManagerKpis,
  formatManagerSubtitle,
  getCertificatesEarnedByMonth,
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

  describe("getCertificatesEarnedByMonth", () => {
    it("ends at the Vietnam calendar month: 18:00 UTC on 31 Oct is already 1 Nov in Vietnam", () => {
      // issued_date is a plain date, so only the current month depends on the time zone.
      const now = new Date("2026-10-31T18:00:00Z");
      const months = getCertificatesEarnedByMonth([doneRecord(100, { issuedDate: "2026-11-01" })], 3, now);
      expect(months.map((m) => m.monthKey)).toEqual(["2026-09", "2026-10", "2026-11"]);
      expect(months[2].count).toBe(1);
    });

    it("groups certificates by last 6 calendar months and identifies peak month", () => {
      const now = new Date("2026-06-15T00:00:00Z");
      const records = [
        doneRecord(100, { issuedDate: "2026-06-01" }),
        doneRecord(100, { issuedDate: "2026-06-10" }),
        doneRecord(100, { issuedDate: "2026-05-15" }),
        doneRecord(100, { issuedDate: "2026-04-20" }),
        doneRecord(100, { issuedDate: "2025-01-01" }), // outside 6 months
      ];

      const months = getCertificatesEarnedByMonth(records, 6, now);
      expect(months).toHaveLength(6);
      expect(months.map((m) => m.monthKey)).toEqual([
        "2026-01",
        "2026-02",
        "2026-03",
        "2026-04",
        "2026-05",
        "2026-06",
      ]);

      const jun = months.find((m) => m.monthKey === "2026-06")!;
      expect(jun.count).toBe(2);
      expect(jun.isPeak).toBe(true);

      const may = months.find((m) => m.monthKey === "2026-05")!;
      expect(may.count).toBe(1);
      expect(may.isPeak).toBe(false);
    });
  });

  describe("getPlannedExams", () => {
    it("returns upcoming planned exams within the next 60 days sorted by days remaining", () => {
      const now = new Date("2026-11-08T00:00:00Z");
      const records = [
        makeRecord({ id: "r1", memberName: "An", plannedExamDate: "2026-11-20" }), // 12 days
        makeRecord({ id: "r2", memberName: "Bình", plannedExamDate: "2026-11-10" }), // 2 days
        makeRecord({ id: "r3", memberName: "Châu", plannedExamDate: "2027-02-15" }), // > 60 days
        makeRecord({ id: "r4", memberName: "Dung", plannedExamDate: "2026-11-01" }), // past exam
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
      const exp1 = doneRecord(-5, { id: "e1", memberName: "Minh", courseName: "PMP" });
      const exp2 = doneRecord(-1, { id: "e2", memberName: "Tuan", courseName: "CKA" });
      const soon1 = doneRecord(12, { id: "s1", memberName: "Linh", courseName: "AWS SAA" });
      const today = doneRecord(0, { id: "s0", memberName: "Hoa", courseName: "GCP" });
      const later = doneRecord(50, { id: "l1", memberName: "An", courseName: "Terraform" });

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
  });
});
