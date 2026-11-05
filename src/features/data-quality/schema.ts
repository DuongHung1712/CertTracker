import { z } from "zod";

export const ISSUE_TYPES = ["overdue_exam", "done_no_evidence", "member_no_team", "course_no_validity"] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

const rowSchema = z.object({
  issue_type: z.enum(ISSUE_TYPES),
  severity: z.enum(["warning", "info"]),
  subject_id: z.guid(),
  member_id: z.guid().nullable(),
  member_code: z.string().nullable(),
  member_name: z.string().nullable(),
  team_name: z.string().nullable(),
  course_name: z.string().nullable(),
  record_id: z.guid().nullable(),
  since: z.string(),
  days: z.number().int(),
});

export type IssueRow = {
  type: IssueType;
  severity: "warning" | "info";
  subjectId: string;
  memberId: string | null;
  memberCode: string | null;
  memberName: string | null;
  teamName: string | null;
  courseName: string | null;
  recordId: string | null;
  since: string;
  days: number;
};

/** Throws on any row that does not match the view contract: a silently dropped finding is worse than an error page. */
export function parseIssues(rows: unknown[]): IssueRow[] {
  return rows.map((raw) => {
    const r = rowSchema.parse(raw);
    return {
      type: r.issue_type,
      severity: r.severity,
      subjectId: r.subject_id,
      memberId: r.member_id,
      memberCode: r.member_code,
      memberName: r.member_name,
      teamName: r.team_name,
      courseName: r.course_name,
      recordId: r.record_id,
      since: r.since,
      days: r.days,
    };
  });
}
