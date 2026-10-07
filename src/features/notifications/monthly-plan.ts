import { ratePercent } from "@/features/dashboard/metrics";
import {
  buildExpiryItems,
  byUrgency,
  isDeliverable,
  normalizeEmail,
  type ExpiryItem,
} from "@/features/notifications/expiry-plan";
import { monthRange } from "@/features/notifications/period";
import type { Snapshot, SnapshotMember, SnapshotRecord, StaffUser } from "@/features/notifications/types";

export type Kpi = {
  members: number;
  records: number;
  done: number;
  inProgress: number;
  notStarted: number;
  /** done and not expired, No Expiry included — Dashboard decision #31. */
  valid: number;
  /** done and expiring within 60 days (Expiring Soon + Expiring in 60d). */
  expiring: number;
  expired: number;
  issuedInMonth: number;
  expiredInMonth: number;
  completionRate: number | null;
};
export type TeamKpi = { teamId: string | null; teamName: string; kpi: Kpi };
export type MonthlyReport = {
  email: string;
  name: string | null;
  scope: "org" | "teams";
  month: string;
  overall: Kpi;
  teams: TeamKpi[];
  upcoming: ExpiryItem[];
};

export const NO_TEAM_LABEL = "Chưa có team";

const viCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });
const within = (date: string | null, start: string, end: string) => date !== null && date >= start && date <= end;

function kpiFor(members: SnapshotMember[], records: SnapshotRecord[], range: { start: string; end: string }): Kpi {
  const ids = new Set(members.map((m) => m.id));
  const mine = records.filter((r) => ids.has(r.memberId));
  const done = mine.filter((r) => r.status === "done");
  return {
    members: members.length,
    records: mine.length,
    done: done.length,
    inProgress: mine.filter((r) => r.status === "in_progress").length,
    notStarted: mine.filter((r) => r.status === "not_started").length,
    valid: done.filter((r) => r.expiryStatus !== "Expired").length,
    expiring: done.filter((r) => r.expiryStatus === "Expiring Soon" || r.expiryStatus === "Expiring in 60d").length,
    expired: done.filter((r) => r.expiryStatus === "Expired").length,
    issuedInMonth: done.filter((r) => within(r.issuedDate, range.start, range.end)).length,
    expiredInMonth: done.filter((r) => r.expiryStatus === "Expired" && within(r.expiryDate, range.start, range.end)).length,
    completionRate: ratePercent(done.length, mine.length),
  };
}

type Scope = Pick<MonthlyReport, "scope" | "overall" | "teams" | "upcoming">;

/** Admin: the whole organisation, one row per team with active members, then the members without a team. */
function orgScope(s: Snapshot, active: SnapshotMember[], upcomingAll: ExpiryItem[], range: { start: string; end: string }): Scope {
  const teams: TeamKpi[] = s.teams
    .map((t) => ({ t, members: active.filter((m) => m.teamId === t.id) }))
    .filter(({ members }) => members.length > 0)
    .sort((a, b) => viCollator.compare(a.t.name, b.t.name))
    .map(({ t, members }) => ({ teamId: t.id, teamName: t.name, kpi: kpiFor(members, s.records, range) }));
  // A member whose team id matches no known team is as "team-less" as one with `teamId: null`.
  const knownTeamIds = new Set(s.teams.map((t) => t.id));
  const teamless = active.filter((m) => m.teamId === null || !knownTeamIds.has(m.teamId));
  if (teamless.length > 0) teams.push({ teamId: null, teamName: NO_TEAM_LABEL, kpi: kpiFor(teamless, s.records, range) });
  return { scope: "org", overall: kpiFor(active, s.records, range), teams, upcoming: upcomingAll };
}

/** Manager: only the teams they manage that exist and have active members. `null` when there is nothing to report. */
function teamsScope(
  s: Snapshot,
  u: StaffUser,
  active: SnapshotMember[],
  upcomingAll: ExpiryItem[],
  range: { start: string; end: string },
): Scope | null {
  const wanted = new Set(u.teamIds);
  const mine = s.teams
    .filter((t) => wanted.has(t.id))
    .map((t) => ({ t, members: active.filter((m) => m.teamId === t.id) }))
    .filter(({ members }) => members.length > 0)
    .sort((a, b) => viCollator.compare(a.t.name, b.t.name));
  if (mine.length === 0) return null;
  const memberIds = new Set(mine.flatMap(({ members }) => members.map((m) => m.id)));
  return {
    scope: "teams",
    overall: kpiFor(
      mine.flatMap(({ members }) => members),
      s.records,
      range,
    ),
    teams: mine.map(({ t, members }) => ({ teamId: t.id, teamName: t.name, kpi: kpiFor(members, s.records, range) })),
    upcoming: upcomingAll.filter((i) => memberIds.has(i.memberId)),
  };
}

export function planMonthlyReports(
  s: Snapshot,
  month: string,
): { reports: MonthlyReport[]; undeliverable: string[] } {
  const range = monthRange(month);
  const active = s.members.filter((m) => m.isActive);
  const membersById = new Map(s.members.map((m) => [m.id, m]));
  const upcomingAll = buildExpiryItems(s.records, membersById)
    .filter((i) => i.bucket !== "expired")
    .sort(byUrgency);

  const reports = new Map<string, MonthlyReport>();
  const undeliverable = new Set<string>();

  // Admins first, so that when one address belongs to both an admin and a manager the broader report wins.
  const staff = [...s.staff].sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin"));
  for (const u of staff) {
    if (u.role !== "admin" && u.role !== "manager") continue;
    const self = u.memberId ? membersById.get(u.memberId) : undefined;
    if (self && !self.isActive) continue; // linked member left the company: no mail at all

    const scope = u.role === "admin" ? orgScope(s, active, upcomingAll, range) : teamsScope(s, u, active, upcomingAll, range);
    if (!scope || scope.overall.members === 0) continue;

    if (!isDeliverable(u.email)) {
      undeliverable.add(u.email);
      continue;
    }
    const key = normalizeEmail(u.email);
    if (reports.has(key)) continue;
    reports.set(key, { email: key, name: self?.fullName ?? null, month, ...scope });
  }

  return {
    reports: [...reports.values()].sort((a, b) => a.email.localeCompare(b.email)),
    undeliverable: [...undeliverable].sort(),
  };
}
