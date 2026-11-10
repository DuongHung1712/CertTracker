import type { RecordStatus } from "@/components/status/labels";

type StatusField = "plannedExamDate" | "issuedDate" | "certificateUrl";

export function visibleFields(status: RecordStatus): {
  progress: boolean;
  plannedExamDate: boolean;
  issuedDate: boolean;
  certificateUrl: boolean;
  evidence: boolean;
} {
  return {
    progress: status === "in_progress",
    plannedExamDate: status !== "done",
    issuedDate: status === "done",
    certificateUrl: status === "done",
    evidence: status === "done",
  };
}

/** Progress to apply and the hidden fields to empty when the status changes. */
export function valuesOnStatusChange(
  next: RecordStatus,
  current: { progress: number },
): { progress: number; clear: StatusField[] } {
  if (next === "done") return { progress: 100, clear: ["plannedExamDate"] };
  const clear: StatusField[] = ["issuedDate", "certificateUrl"];
  if (next === "not_started") return { progress: 0, clear };
  return { progress: current.progress === 100 ? 0 : current.progress, clear };
}
