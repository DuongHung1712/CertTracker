import { formatDate } from "@/lib/format";
import { ISSUE_TYPES, type IssueRow, type IssueType } from "@/features/data-quality/schema";

/** `href` is the screen where the finding is fixed; the list pages have no deep link to a single row. */
export const ISSUE_META: Record<IssueType, { label: string; href: string }> = {
  overdue_exam: { label: "Quá hạn thi", href: "/records" },
  done_no_evidence: { label: "Thiếu minh chứng", href: "/records" },
  member_no_team: { label: "Chưa có team", href: "/members" },
  course_no_validity: { label: "Chưa khai báo thời hạn", href: "/courses" },
};

export function describeIssue(row: IssueRow): string {
  switch (row.type) {
    case "overdue_exam":
      return `Dự kiến thi ${formatDate(row.since)} — quá ${row.days} ngày.`;
    case "done_no_evidence":
      return `Hoàn thành ${formatDate(row.since)} nhưng chưa có file hay đường dẫn minh chứng.`;
    case "member_no_team":
      return `Chưa thuộc team nào (thêm từ ${formatDate(row.since)}).`;
    case "course_no_validity":
      return "Chưa khai báo thời hạn hiệu lực. Bỏ qua nếu chứng chỉ này không hết hạn.";
  }
}

export function countByType(rows: IssueRow[]): Record<IssueType, number> {
  const counts = Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) as Record<IssueType, number>;
  for (const row of rows) counts[row.type] += 1;
  return counts;
}
