import { EXPIRING_WINDOW_DAYS, URGENT_WINDOW_DAYS } from "@/features/dashboard/member-metrics";
import { formatRate, ratePercent } from "@/features/dashboard/metrics";
import type { RecordRow } from "@/features/records/queries";
import { todayVn } from "@/lib/dates";
import { pluralize } from "@/lib/plural";

export { EXPIRING_WINDOW_DAYS, URGENT_WINDOW_DAYS };

export type ExpiryWindow = "expired" | "urgent" | "expiring" | "later" | "none";

/**
 * Classifies a certificate by days to expiry.
 * Strictly checks boundaries:
 * < 0: expired
 * 0..30 (URGENT_WINDOW_DAYS): urgent
 * 31..60 (EXPIRING_WINDOW_DAYS): expiring
 * > 60: later
 * null: none
 */
export function expiryWindow(daysToExpiry: number | null): ExpiryWindow {
  if (daysToExpiry === null) return "none";
  if (daysToExpiry < 0) return "expired";
  if (daysToExpiry <= URGENT_WINDOW_DAYS) return "urgent";
  if (daysToExpiry <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "later";
}

export const isDone = (r: RecordRow): boolean => r.status === "done";
export const isValid = (r: RecordRow): boolean => isDone(r) && (r.daysToExpiry === null || r.daysToExpiry >= 0);
export const isExpiring60 = (r: RecordRow): boolean =>
  isDone(r) && r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= EXPIRING_WINDOW_DAYS;
export const isExpiring30 = (r: RecordRow): boolean =>
  isDone(r) && r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= URGENT_WINDOW_DAYS;
export const isExpired = (r: RecordRow): boolean =>
  isDone(r) && r.daysToExpiry !== null && r.daysToExpiry < 0;
export const isInProgress = (r: RecordRow): boolean => r.status === "in_progress";
export const isNotStarted = (r: RecordRow): boolean => r.status === "not_started";

/** Formats a list of team names: ["Cloud"], ["Cloud", "AI"] -> "Cloud and AI", ["A", "B", "C"] -> "A, B and C". */
export function formatTeamNames(teamNames: string[]): string {
  if (teamNames.length === 0) return "";
  if (teamNames.length === 1) return teamNames[0];
  if (teamNames.length === 2) return `${teamNames[0]} and ${teamNames[1]}`;
  return `${teamNames.slice(0, -1).join(", ")} and ${teamNames[teamNames.length - 1]}`;
}

/** Formats the subtitle on the manager dashboard: "You look after Team Cloud (2 members)." */
export function formatManagerSubtitle(teamNames: string[], memberCount: number): string {
  if (teamNames.length === 0) return "No teams assigned yet.";
  const names = formatTeamNames(teamNames);
  return `You look after ${names} (${pluralize(memberCount, "member")}).`;
}

export type ManagerKpis = {
  totalCertificates: number;
  doneCount: number;
  validCount: number;
  expiringCount: number;
  urgentCount: number;
  expiredCount: number;
  inProgressCount: number;
  notStartedCount: number;
  teamReadinessRate: number;
  teamReadinessFormatted: string;
};

export function calculateManagerKpis(records: RecordRow[]): ManagerKpis {
  let doneCount = 0;
  let validCount = 0;
  let expiringCount = 0;
  let urgentCount = 0;
  let expiredCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;

  for (const r of records) {
    if (r.status === "done") {
      doneCount++;
      if (r.daysToExpiry === null || r.daysToExpiry >= 0) {
        validCount++;
      }
      if (r.daysToExpiry !== null) {
        if (r.daysToExpiry < 0) {
          expiredCount++;
        } else if (r.daysToExpiry <= EXPIRING_WINDOW_DAYS) {
          expiringCount++;
          if (r.daysToExpiry <= URGENT_WINDOW_DAYS) urgentCount++;
        }
      }
    } else if (r.status === "in_progress") {
      inProgressCount++;
    } else if (r.status === "not_started") {
      notStartedCount++;
    }
  }

  const teamReadinessRate = doneCount > 0 ? (ratePercent(validCount, doneCount) ?? 0) : 0;

  return {
    totalCertificates: records.length,
    doneCount,
    validCount,
    expiringCount,
    urgentCount,
    expiredCount,
    inProgressCount,
    notStartedCount,
    teamReadinessRate,
    teamReadinessFormatted: formatRate(teamReadinessRate),
  };
}

/** Next to expire: in-scope completed certificates with 0-60 days left, soonest first. */
export function getNextToExpire(records: RecordRow[], limit = 8): RecordRow[] {
  return records
    .filter(isExpiring60)
    .sort((a, b) => {
      const daysDiff = (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0);
      if (daysDiff !== 0) return daysDiff;
      const nameDiff = a.memberName.localeCompare(b.memberName);
      if (nameDiff !== 0) return nameDiff;
      return a.courseName.localeCompare(b.courseName);
    })
    .slice(0, limit);
}

export type MemberReadinessRow = {
  memberId: string;
  memberName: string;
  teamName: string | null;
  validCount: number;
  inProgressCount: number;
  expiredCount: number;
  notStartedCount: number;
  totalCount: number;
  readinessRate: number;
};

export function getTeamReadinessLeague(
  members: { id: string; fullName: string; teamName: string | null }[],
  records: RecordRow[],
): MemberReadinessRow[] {
  const recordsByMember = new Map<string, RecordRow[]>();
  for (const r of records) {
    const list = recordsByMember.get(r.memberId) ?? [];
    list.push(r);
    recordsByMember.set(r.memberId, list);
  }

  const rows: MemberReadinessRow[] = members.map((m) => {
    const memRecords = recordsByMember.get(m.id) ?? [];
    let validCount = 0;
    let inProgressCount = 0;
    let expiredCount = 0;
    let notStartedCount = 0;
    let doneCount = 0;

    for (const r of memRecords) {
      if (r.status === "done") {
        doneCount++;
        if (r.daysToExpiry === null || r.daysToExpiry >= 0) validCount++;
        if (r.daysToExpiry !== null && r.daysToExpiry < 0) expiredCount++;
      } else if (r.status === "in_progress") {
        inProgressCount++;
      } else if (r.status === "not_started") {
        notStartedCount++;
      }
    }

    const readinessRate = doneCount > 0 ? (ratePercent(validCount, doneCount) ?? 0) : 0;

    return {
      memberId: m.id,
      memberName: m.fullName,
      teamName: m.teamName,
      validCount,
      inProgressCount,
      expiredCount,
      notStartedCount,
      totalCount: memRecords.length,
      readinessRate,
    };
  });

  return rows.sort((a, b) => {
    if (b.validCount !== a.validCount) return b.validCount - a.validCount;
    if (b.inProgressCount !== a.inProgressCount) return b.inProgressCount - a.inProgressCount;
    return a.memberName.localeCompare(b.memberName);
  });
}

export type CertificatesEarnedMonth = {
  monthKey: string;
  label: string;
  count: number;
  isPeak: boolean;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Last N calendar months of completed certificates in scope. */
export function getCertificatesEarnedByMonth(
  records: RecordRow[],
  monthsCount = 6,
  now: Date = new Date(),
): CertificatesEarnedMonth[] {
  const result: CertificatesEarnedMonth[] = [];
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0-11

  for (let i = monthsCount - 1; i >= 0; i--) {
    let year = currentYear;
    let month = currentMonth - i;
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const label = MONTH_NAMES[month];
    result.push({
      monthKey,
      label,
      count: 0,
      isPeak: false,
    });
  }

  const countsByKey = new Map<string, number>();
  for (const r of records) {
    if (r.status === "done" && r.issuedDate) {
      const key = r.issuedDate.slice(0, 7);
      countsByKey.set(key, (countsByKey.get(key) ?? 0) + 1);
    }
  }

  let maxCount = 0;
  for (const item of result) {
    item.count = countsByKey.get(item.monthKey) ?? 0;
    if (item.count > maxCount) maxCount = item.count;
  }

  if (maxCount > 0) {
    for (const item of result) {
      if (item.count === maxCount) item.isPeak = true;
    }
  }

  return result;
}

export type PlannedExamItem = {
  recordId: string;
  memberId: string;
  memberName: string;
  courseName: string;
  plannedExamDate: string;
  daysRemaining: number;
};

/** Planned exams within the next 60 days. */
export function getPlannedExams(
  records: RecordRow[],
  withinDays = 60,
  now: Date = new Date(),
): PlannedExamItem[] {
  const todayStr = todayVn(now);
  const todayTime = Date.parse(todayStr);

  const items: PlannedExamItem[] = [];

  for (const r of records) {
    if (r.plannedExamDate) {
      const examTime = Date.parse(r.plannedExamDate);
      if (!Number.isNaN(examTime) && !Number.isNaN(todayTime)) {
        const daysRemaining = Math.round((examTime - todayTime) / 86_400_000);
        if (daysRemaining >= 0 && daysRemaining <= withinDays) {
          items.push({
            recordId: r.id,
            memberId: r.memberId,
            memberName: r.memberName,
            courseName: r.courseName,
            plannedExamDate: r.plannedExamDate,
            daysRemaining,
          });
        }
      }
    }
  }

  return items.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
    return a.memberName.localeCompare(b.memberName);
  });
}

type NeedsAttentionItem = {
  record: RecordRow;
  description: string;
};

/** Expired certificates, most overdue first. Upcoming expiries are listed in Next to expire. */
export function getNeedsAttentionItems(records: RecordRow[]): NeedsAttentionItem[] {
  return records
    .filter(isExpired)
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0))
    .map((record) => ({
      record,
      description: `${record.memberName}'s ${record.courseName} expired ${pluralize(-(record.daysToExpiry ?? 0), "day")} ago.`,
    }));
}

/** Returns members who have no completed certificates yet. */
export function getMembersWithoutCerts(
  members: { id: string; fullName: string; teamName: string | null }[],
  records: RecordRow[],
): { id: string; fullName: string; teamName: string | null }[] {
  const membersWithCompleted = new Set(
    records.filter((r) => r.status === "done").map((r) => r.memberId),
  );
  return members.filter((m) => !membersWithCompleted.has(m.id));
}

