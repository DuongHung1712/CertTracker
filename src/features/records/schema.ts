import { z } from "zod";
import type { RecordStatus } from "@/components/status/labels";
import { toIsoDate, todayVn } from "@/lib/dates";

export const RECORD_STATUSES = ["not_started", "in_progress", "done"] as const;
export const REFUND_STATUSES = ["n_a", "pending", "approved", "rejected", "paid"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  n_a: "Không áp dụng",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  paid: "Đã hoàn tiền",
};

/** `z.guid()`, not `.uuid()`: seed ids are not RFC 4122 (see src/features/members/schema.ts). */
export const idSchema = z.object({ id: z.guid("Dữ liệu không hợp lệ") });

const blankToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === undefined || (typeof value === "string" && value.trim() === "") ? null : value),
    schema.nullable(),
  );

const optionalDate = (message: string) =>
  blankToNull(
    z
      .string()
      .refine((value) => toIsoDate(value) !== null, message)
      .transform((value) => toIsoDate(value) as string),
  );

/** The database CHECK constraints plus the "not in the future" rule, as data — reused by the Excel import. */
export function recordRuleIssues(
  value: { status: RecordStatus; progress: number; issuedDate: string | null },
  today: string,
): { path: "progress" | "issuedDate"; message: string }[] {
  const issues: { path: "progress" | "issuedDate"; message: string }[] = [];
  if (value.status === "done" && value.progress !== 100) {
    issues.push({ path: "progress", message: "Hoàn thành thì tiến độ phải là 100%" });
  }
  if (value.status === "done" && !value.issuedDate) {
    issues.push({ path: "issuedDate", message: "Hoàn thành thì cần ngày cấp" });
  }
  if (value.status === "not_started" && value.progress !== 0) {
    issues.push({ path: "progress", message: "Chưa bắt đầu thì tiến độ phải là 0%" });
  }
  if (value.status === "in_progress" && value.progress > 99) {
    issues.push({ path: "progress", message: "Tiến độ 100% thì chọn trạng thái Hoàn thành" });
  }
  // ISO dates compare correctly as strings.
  if (value.issuedDate && value.issuedDate > today) {
    issues.push({ path: "issuedDate", message: "Ngày cấp không được ở tương lai" });
  }
  return issues;
}

export const recordSchema = z
  .object({
    memberId: z.guid("Vui lòng chọn thành viên"),
    courseId: z.guid("Vui lòng chọn khóa học"),
    status: z.enum(RECORD_STATUSES, "Vui lòng chọn trạng thái"),
    progress: z.coerce
      .number("Tiến độ phải là số")
      .int("Tiến độ phải là số nguyên")
      .min(0, "Tiến độ từ 0 đến 100")
      .max(100, "Tiến độ từ 0 đến 100"),
    plannedExamDate: optionalDate("Ngày thi dự kiến không hợp lệ (dd/mm/yyyy)"),
    issuedDate: optionalDate("Ngày cấp không hợp lệ (dd/mm/yyyy)"),
    certificateUrl: blankToNull(
      z
        .string()
        .trim()
        .url("Đường dẫn không hợp lệ")
        .refine((value) => /^https?:\/\//i.test(value), "Đường dẫn phải bắt đầu bằng http:// hoặc https://"),
    ),
    // Optional on purpose: a Member's form does not render these. `undefined` means "leave the
    // column alone" — sending a default would make the column-guard trigger raise 42501 whenever
    // an admin had set a different value.
    viaCompany: z.boolean().optional(),
    refundStatus: z.enum(REFUND_STATUSES).optional(),
    notes: blankToNull(z.string().trim().max(2000, "Ghi chú tối đa 2000 ký tự")),
  })
  .superRefine((value, ctx) => {
    for (const issue of recordRuleIssues(value, todayVn())) {
      ctx.addIssue({ code: "custom", path: [issue.path], message: issue.message });
    }
  });
export type RecordInput = z.infer<typeof recordSchema>;
