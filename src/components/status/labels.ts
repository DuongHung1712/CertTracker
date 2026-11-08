import type { Database } from "@/types/database";

export type RecordStatus = Database["public"]["Enums"]["record_status"];
export type Role = Database["public"]["Enums"]["user_role"];

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  done: "Completed",
  in_progress: "In progress",
  not_started: "Not started",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  member: "Member",
};

/** Label for rows without a team; shared by the records filter, data quality and the monthly report. */
export const NO_TEAM_LABEL = "No team";

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
