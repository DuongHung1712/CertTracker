import { describe, expect, it } from "vitest";
import { countByType, describeIssue, ISSUE_META } from "@/features/data-quality/issues";
import { ISSUE_TYPES, type IssueRow } from "@/features/data-quality/schema";

const row = (over: Partial<IssueRow>): IssueRow => ({
  type: "overdue_exam", severity: "warning", subjectId: "s", memberId: "m", memberCode: "M001", memberName: "An",
  teamName: "T", courseName: "C", recordId: "r", since: "2026-10-01", days: 3, ...over,
});

describe("describeIssue", () => {
  it("states the exam date and how late it is", () => {
    expect(describeIssue(row({ type: "overdue_exam", since: "2026-10-01", days: 3 }))).toBe("Dự kiến thi 01/10/2026 — quá 3 ngày.");
  });
  it("says what is missing for a done record", () => {
    expect(describeIssue(row({ type: "done_no_evidence", since: "2026-09-20" }))).toBe(
      "Hoàn thành 20/09/2026 nhưng chưa có file hay đường dẫn minh chứng.",
    );
  });
  it("explains a member without a team", () => {
    expect(describeIssue(row({ type: "member_no_team", since: "2026-08-01" }))).toBe("Chưa thuộc team nào (thêm từ 01/08/2026).");
  });
  it("tells the admin when a missing validity can be ignored", () => {
    expect(describeIssue(row({ type: "course_no_validity" }))).toBe(
      "Chưa khai báo thời hạn hiệu lực. Bỏ qua nếu chứng chỉ này không hết hạn.",
    );
  });
});

describe("countByType", () => {
  it("counts every type, including zero", () => {
    const counts = countByType([row({}), row({}), row({ type: "member_no_team" })]);
    expect(counts).toEqual({ overdue_exam: 2, done_no_evidence: 0, member_no_team: 1, course_no_validity: 0 });
  });
});

describe("ISSUE_META", () => {
  it("has a Vietnamese label and a target page for every type", () => {
    for (const type of ISSUE_TYPES) {
      expect(ISSUE_META[type].label.length).toBeGreaterThan(0);
      expect(ISSUE_META[type].href).toMatch(/^\//);
    }
  });
});
