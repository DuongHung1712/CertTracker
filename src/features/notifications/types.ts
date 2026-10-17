import type { Role } from "@/components/status/labels";

export type NotificationKind = "expiry-alert" | "monthly-report";

export type SnapshotMember = {
  id: string;
  code: string;
  fullName: string;
  email: string;
  teamId: string | null;
  isActive: boolean;
};
export type SnapshotTeam = { id: string; name: string };
export type SnapshotRecord = {
  id: string;
  memberId: string;
  status: "not_started" | "in_progress" | "done";
  courseName: string;
  issuedDate: string | null;
  expiryDate: string | null;
  daysToExpiry: number | null;
  /** `v_training_records.expiry_status`, so the thresholds live only in SQL (decisions #10). */
  expiryStatus: string;
};
/** An admin/manager account with a usable login (`notification_staff()`). */
export type StaffUser = { userId: string; email: string; role: Role; memberId: string | null; teamIds: string[] };

export type Snapshot = {
  members: SnapshotMember[];
  teams: SnapshotTeam[];
  staff: StaffUser[];
  records: SnapshotRecord[];
};
