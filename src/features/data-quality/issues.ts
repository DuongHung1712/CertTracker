import { NO_TEAM_LABEL } from "@/components/status/labels";
import { formatDate } from "@/lib/format";
import { pluralize } from "@/lib/plural";
import { ISSUE_TYPES, type IssueRow, type IssueType } from "@/features/data-quality/schema";

/** `href` is the screen where the finding is fixed; the list pages have no deep link to a single row. */
export const ISSUE_META: Record<IssueType, { label: string; href: string }> = {
  overdue_exam: { label: "Exam overdue", href: "/records" },
  done_no_evidence: { label: "Missing evidence", href: "/records" },
  member_no_team: { label: NO_TEAM_LABEL, href: "/members" },
  certificate_no_validity: { label: "Validity not set", href: "/courses" },
};

export function describeIssue(row: IssueRow): string {
  switch (row.type) {
    case "overdue_exam":
      return `Exam planned for ${formatDate(row.since)} — ${pluralize(row.days, "day")} overdue.`;
    case "done_no_evidence":
      return `Completed on ${formatDate(row.since)} but there is no evidence file or link.`;
    case "member_no_team":
      return `Not in any team (added on ${formatDate(row.since)}).`;
    case "certificate_no_validity":
      return "No validity period is set. Ignore this if the certificate does not expire.";
  }
}

export function countByType(rows: IssueRow[]): Record<IssueType, number> {
  const counts = Object.fromEntries(ISSUE_TYPES.map((type) => [type, 0])) as Record<IssueType, number>;
  for (const row of rows) counts[row.type] += 1;
  return counts;
}
