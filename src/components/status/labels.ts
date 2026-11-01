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

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
