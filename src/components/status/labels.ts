import type { Database } from "@/types/database";

export type RecordStatus = Database["public"]["Enums"]["record_status"];
export type Role = Database["public"]["Enums"]["user_role"];

export const RECORD_STATUS_LABEL: Record<RecordStatus, string> = {
  done: "Hoàn thành",
  in_progress: "Đang học",
  not_started: "Chưa bắt đầu",
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Quản trị",
  manager: "Quản lý",
  member: "Thành viên",
};

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}
