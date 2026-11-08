import type { ExpiryStatus } from "@/components/status/expiry";
import type { RecordRow } from "@/features/records/queries";

/** A `RecordRow` whose `expiryStatus` can only be a value `v_training_records.expiry_status` really returns. */
export function makeRecord(
  partial: Partial<Omit<RecordRow, "expiryStatus">> & { expiryStatus?: ExpiryStatus | null } = {},
): RecordRow {
  return {
    id: "r1",
    memberId: "m1",
    memberCode: "M001",
    memberName: "Le Minh Chau",
    memberEmail: "member@certtracker.test",
    teamId: "t1",
    teamName: "Team Cloud",
    courseId: "c1",
    courseName: "AWS Solutions Architect Associate",
    certTypeName: "Cloud",
    providerName: "AWS",
    validityMonths: 36,
    cost: 150,
    costCurrency: "USD",
    estHours: 40,
    status: "done",
    progress: 100,
    plannedExamDate: null,
    issuedDate: "2023-10-01",
    certificateUrl: null,
    hasEvidence: false,
    viaCompany: false,
    refundStatus: "n_a",
    notes: null,
    expiryDate: "2027-03-08",
    daysToExpiry: 120,
    expiryStatus: "Active",
    ...partial,
  };
}

/** Mirrors SQL `expiry_status()` (migration 20260928000003) for a dated certificate. */
export function expiryStatusForDays(days: number): ExpiryStatus {
  if (days < 0) return "Expired";
  if (days <= 30) return "Expiring Soon";
  if (days <= 60) return "Expiring in 60d";
  return "Active";
}

/** A done, dated certificate `days` from expiry, with the status the view would return. */
export function doneRecord(days: number, partial: Parameters<typeof makeRecord>[0] = {}): RecordRow {
  return makeRecord({ daysToExpiry: days, expiryStatus: expiryStatusForDays(days), ...partial });
}

/** A done certificate whose course has no validity (`No Expiry`). */
export function noExpiryRecord(partial: Parameters<typeof makeRecord>[0] = {}): RecordRow {
  return makeRecord({ validityMonths: null, expiryDate: null, daysToExpiry: null, expiryStatus: "No Expiry", ...partial });
}
