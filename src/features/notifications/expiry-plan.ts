import type { Snapshot, SnapshotMember, SnapshotRecord } from "@/features/notifications/types";

export type ExpiryBucket = "expired" | "soon" | "in60";
export type ExpiryItem = {
  recordId: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  courseName: string;
  expiryDate: string;
  daysToExpiry: number;
  bucket: ExpiryBucket;
};
export type TeamSection = { teamId: string; teamName: string; items: ExpiryItem[] };
export type ExpiryAlert = { email: string; name: string | null; own: ExpiryItem[]; teams: TeamSection[] };

/** Decisions #37: a certificate that died more than this many days ago is not nagged about forever. */
export const RECENTLY_EXPIRED_DAYS = 30;
/** Decisions #37: longest list shown per section before "và N chứng chỉ khác". */
export const MAX_LINES = 25;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isDeliverable = (email: string): boolean => EMAIL_SHAPE.test(email.trim());
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function capItems<T>(items: T[], max: number = MAX_LINES): { shown: T[]; hidden: number } {
  return { shown: items.slice(0, max), hidden: Math.max(0, items.length - max) };
}

/** Thresholds come from SQL (`expiry_status`), never recomputed here. Only `done` records hold a certificate. */
export function expiryBucket(r: Pick<SnapshotRecord, "status" | "daysToExpiry" | "expiryStatus">): ExpiryBucket | null {
  if (r.status !== "done" || r.daysToExpiry === null) return null;
  if (r.expiryStatus === "Expiring Soon") return "soon";
  if (r.expiryStatus === "Expiring in 60d") return "in60";
  if (r.expiryStatus === "Expired" && r.daysToExpiry >= -RECENTLY_EXPIRED_DAYS) return "expired";
  return null;
}

const viCollator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });
export const byUrgency = (a: ExpiryItem, b: ExpiryItem): number =>
  a.daysToExpiry - b.daysToExpiry ||
  viCollator.compare(a.memberName, b.memberName) ||
  viCollator.compare(a.courseName, b.courseName);

export function buildExpiryItems(records: SnapshotRecord[], membersById: Map<string, SnapshotMember>): ExpiryItem[] {
  return records.flatMap((r): ExpiryItem[] => {
    const m = membersById.get(r.memberId);
    const bucket = expiryBucket(r);
    if (!m || !m.isActive || bucket === null || r.daysToExpiry === null || r.expiryDate === null) return [];
    return [
      {
        recordId: r.id,
        memberId: m.id,
        memberName: m.fullName,
        memberCode: m.code,
        courseName: r.courseName,
        expiryDate: r.expiryDate,
        daysToExpiry: r.daysToExpiry,
        bucket,
      },
    ];
  });
}

type Draft = { email: string; name: string | null; own: ExpiryItem[]; teams: TeamSection[] };

export function planExpiryAlerts(s: Snapshot): { alerts: ExpiryAlert[]; undeliverable: string[] } {
  const membersById = new Map(s.members.map((m) => [m.id, m]));
  const teamNames = new Map(s.teams.map((t) => [t.id, t.name]));
  const items = buildExpiryItems(s.records, membersById);
  const itemsByMember = new Map<string, ExpiryItem[]>();
  for (const item of items) itemsByMember.set(item.memberId, [...(itemsByMember.get(item.memberId) ?? []), item]);
  // A staff account linked to a member receives that member's certificates in its own mail (decisions #34).
  const staffByMember = new Map(s.staff.flatMap((u) => (u.memberId ? [[u.memberId, u] as const] : [])));

  const drafts = new Map<string, Draft>();
  const undeliverable = new Set<string>();
  const draftFor = (email: string, name: string | null): Draft | null => {
    if (!isDeliverable(email)) {
      undeliverable.add(email);
      return null;
    }
    const key = normalizeEmail(email);
    const existing = drafts.get(key);
    if (existing) {
      existing.name ??= name;
      return existing;
    }
    const draft: Draft = { email: key, name, own: [], teams: [] };
    drafts.set(key, draft);
    return draft;
  };

  for (const m of s.members) {
    const own = itemsByMember.get(m.id);
    if (!m.isActive || !own?.length) continue;
    const draft = draftFor(staffByMember.get(m.id)?.email ?? m.email, m.fullName);
    if (draft) draft.own = [...draft.own, ...own].sort(byUrgency);
  }

  for (const u of s.staff) {
    if (u.role !== "manager") continue;
    const self = u.memberId ? membersById.get(u.memberId) : undefined;
    if (self && !self.isActive) continue; // linked member left the company: no mail at all
    const sections = u.teamIds.flatMap((teamId): TeamSection[] => {
      const teamName = teamNames.get(teamId);
      const teamItems = items.filter((i) => i.memberId !== u.memberId && membersById.get(i.memberId)?.teamId === teamId);
      return teamName && teamItems.length ? [{ teamId, teamName, items: teamItems.sort(byUrgency) }] : [];
    });
    if (!sections.length) continue;
    const draft = draftFor(u.email, self?.fullName ?? null);
    if (draft) draft.teams = sections.sort((a, b) => viCollator.compare(a.teamName, b.teamName));
  }

  const alerts = [...drafts.values()]
    .filter((d) => d.own.length > 0 || d.teams.length > 0)
    .sort((a, b) => a.email.localeCompare(b.email));
  return { alerts, undeliverable: [...undeliverable].sort() };
}
