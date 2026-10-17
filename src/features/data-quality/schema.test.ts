import { describe, expect, it } from "vitest";
import { parseIssues } from "@/features/data-quality/schema";

const base = {
  issue_type: "overdue_exam",
  severity: "warning",
  subject_id: "d9000000-0000-0000-0000-0000000000e1",
  member_id: "d9000000-0000-0000-0000-00000000b001",
  member_code: "M001",
  member_name: "Nguyễn Văn An",
  team_name: "Team Cloud",
  course_name: "AWS SAA",
  record_id: "d9000000-0000-0000-0000-0000000000e1",
  since: "2026-10-01",
  days: 3,
};

describe("parseIssues", () => {
  it("maps a record-level row to camelCase", () => {
    expect(parseIssues([base])).toEqual([
      {
        type: "overdue_exam",
        severity: "warning",
        subjectId: base.subject_id,
        memberId: base.member_id,
        memberCode: "M001",
        memberName: "Nguyễn Văn An",
        teamName: "Team Cloud",
        courseName: "AWS SAA",
        recordId: base.record_id,
        since: "2026-10-01",
        days: 3,
      },
    ]);
  });

  it("accepts the nullable columns of member-level and course-level rows", () => {
    const [row] = parseIssues([
      { ...base, issue_type: "course_no_validity", severity: "info", member_id: null, member_code: null, member_name: null, team_name: null, record_id: null },
    ]);
    expect(row).toMatchObject({ type: "course_no_validity", memberId: null, memberName: null, recordId: null });
  });

  it("rejects an unknown issue type instead of silently dropping the row (edge #70)", () => {
    expect(() => parseIssues([{ ...base, issue_type: "something_new" }])).toThrow();
  });

  it("rejects a row without a usable subject id", () => {
    expect(() => parseIssues([{ ...base, subject_id: "nope" }])).toThrow();
  });
});
