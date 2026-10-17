import { z } from "zod";

const count = z.number().int().nonnegative();

const kpisRow = z.object({
  total_members: count, total_records: count, done_records: count, in_progress_records: count,
  not_started_records: count, active_certs: count, expiring_60_certs: count, expiring_soon_certs: count,
  expired_certs: count, no_expiry_certs: count,
});

export type DashboardKpis = {
  totalMembers: number; totalRecords: number; doneRecords: number; inProgressRecords: number;
  notStartedRecords: number; activeCerts: number; expiring60Certs: number; expiringSoonCerts: number;
  expiredCerts: number; noExpiryCerts: number;
};

/** `dashboard_kpis()` returns exactly one row; anything else is a contract break. */
export function parseKpis(data: unknown): DashboardKpis {
  const [r] = z.array(kpisRow).length(1).parse(data) as [z.infer<typeof kpisRow>];
  return {
    totalMembers: r.total_members, totalRecords: r.total_records, doneRecords: r.done_records,
    inProgressRecords: r.in_progress_records, notStartedRecords: r.not_started_records,
    activeCerts: r.active_certs, expiring60Certs: r.expiring_60_certs, expiringSoonCerts: r.expiring_soon_certs,
    expiredCerts: r.expired_certs, noExpiryCerts: r.no_expiry_certs,
  };
}

export const BREAKDOWN_DIMENSIONS = ["team", "cert_type", "provider", "course"] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

const breakdownRow = z.object({
  group_key: z.string(), group_label: z.string(), headcount: count.nullable(), people: count, records: count,
  done: count, in_progress: count, not_started: count, valid: count, expired: count,
});

export type BreakdownRow = {
  key: string; label: string; headcount: number | null; people: number; records: number;
  done: number; inProgress: number; notStarted: number; valid: number; expired: number;
};

export function parseBreakdown(data: unknown): BreakdownRow[] {
  return z.array(breakdownRow).parse(data).map((r) => ({
    key: r.group_key, label: r.group_label, headcount: r.headcount, people: r.people, records: r.records,
    done: r.done, inProgress: r.in_progress, notStarted: r.not_started, valid: r.valid, expired: r.expired,
  }));
}

const rankingRow = z.object({
  // z.guid(), not .uuid(): seed ids are not RFC 4122 (see src/features/members/schema.ts).
  member_id: z.guid(), member_code: z.string(), full_name: z.string(), team_name: z.string().nullable(),
  valid_certs: count, done_certs: count, in_progress: count, rank: z.number().int().min(1),
});

export type RankingRow = {
  memberId: string; memberCode: string; fullName: string; teamName: string | null;
  validCerts: number; doneCerts: number; inProgress: number; rank: number;
};

export function parseRanking(data: unknown): RankingRow[] {
  return z.array(rankingRow).parse(data).map((r) => ({
    memberId: r.member_id, memberCode: r.member_code, fullName: r.full_name, teamName: r.team_name,
    validCerts: r.valid_certs, doneCerts: r.done_certs, inProgress: r.in_progress, rank: r.rank,
  }));
}
