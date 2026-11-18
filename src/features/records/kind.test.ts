import { describe, expect, it } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { filterByKind, isApprovedDone, isRecordDeletableByMember, isReviewable, issuedDateHint, issuedDateLabel, kindCounts, learningPath, plannedDateHeader, plannedDateLabel, recordSavedMessage, recordSheetTitle } from "@/features/records/kind";

const exam = makeRecord({ id: "e1", certificateKind: "exam" });
const completion = makeRecord({ id: "c1", certificateKind: "completion" });
const rows = [exam, completion, makeRecord({ id: "e2", certificateKind: "exam" })];

describe("isReviewable", () => {
  it("a manager's own waiting item is not reviewable; another's is; an admin (null) reviews anyone's", () => {
    const own = makeRecord({ memberId: "boss", approval: "waiting" });
    const other = makeRecord({ memberId: "m1", approval: "waiting" });
    expect(isReviewable(own, "boss")).toBe(false);
    expect(isReviewable(other, "boss")).toBe(true);
    expect(isReviewable(own, null)).toBe(true);
    expect(isReviewable(makeRecord({ memberId: "m1", approval: "returned" }), null)).toBe(false);
  });
});

describe("isRecordDeletableByMember", () => {
  it("allows member to delete not_started or in_progress draft records", () => {
    expect(isRecordDeletableByMember({ status: "not_started" })).toBe(true);
    expect(isRecordDeletableByMember({ status: "in_progress" })).toBe(true);
  });

  it("allows member to delete returned records so they can be cleaned up or recreated", () => {
    expect(isRecordDeletableByMember({ status: "done", approval: "returned" })).toBe(true);
  });

  it("blocks member from deleting waiting or approved done records", () => {
    expect(isRecordDeletableByMember({ status: "done", approval: "waiting" })).toBe(false);
    expect(isRecordDeletableByMember({ status: "done", approval: "approved" })).toBe(false);
    expect(isRecordDeletableByMember({ status: "done", approval: null })).toBe(false);
  });
});

describe("isApprovedDone", () => {
  it("counts a Completed item once approved, until a later approved renewal replaces it", () => {
    expect(isApprovedDone({ status: "done", approval: "approved" })).toBe(true);
    expect(isApprovedDone({ status: "done", approval: "approved", renewed: false })).toBe(true);
    expect(isApprovedDone({ status: "done", approval: "approved", renewed: true })).toBe(false);
    expect(isApprovedDone({ status: "done", approval: "waiting" })).toBe(false);
    expect(isApprovedDone({ status: "in_progress", approval: null })).toBe(false);
  });
});

describe("kind filter", () => {
  it("keeps every row for all and only the matching kind otherwise", () => {
    expect(filterByKind(rows, "all")).toHaveLength(3);
    expect(filterByKind(rows, "exam").map((r) => r.id)).toEqual(["e1", "e2"]);
    expect(filterByKind(rows, "completion").map((r) => r.id)).toEqual(["c1"]);
  });

  it("counts so that exam + completion = all", () => {
    expect(kindCounts(rows)).toEqual({ all: 3, exam: 2, completion: 1 });
  });

  it("words the sheet title and the saved message after the chosen kind, neutral before one is chosen", () => {
    expect(recordSheetTitle(false, undefined)).toBe("Add certificate or course completion");
    expect(recordSheetTitle(false, "exam")).toBe("Add certificate");
    expect(recordSheetTitle(false, "completion")).toBe("Add course completion");
    expect(recordSheetTitle(true, "completion")).toBe("Edit course completion");
    expect(recordSavedMessage(true, "completion")).toBe("Saved course completion");
    expect(recordSavedMessage(false, "exam")).toBe("Added certificate");
    expect(recordSavedMessage(false, undefined)).toBe("Added certificate");
  });

  it("names the planned date by kind", () => {
    expect(plannedDateLabel("exam")).toBe("Planned exam date");
    expect(plannedDateLabel("completion")).toBe("Planned finish date");
    expect(plannedDateHeader("all")).toBe("Planned date");
    expect(plannedDateHeader("exam")).toBe("Planned exam date");
  });
});

describe("issued date wording", () => {
  it("calls the date of an exam the day it was passed and keeps Issue date for a completion", () => {
    expect(issuedDateLabel("exam")).toBe("Date passed");
    expect(issuedDateLabel("completion")).toBe("Issue date");
    expect(issuedDateHint("exam")).toMatch(/passed/);
    expect(issuedDateHint("completion")).toMatch(/issued/);
  });
});

describe("learningPath", () => {
  const exam = { certificateKind: "exam" as const, status: "in_progress" as const, certificateName: "AWS Solutions Architect Associate", providerName: "AWS" };
  it("names the preparing course of an exam", () => {
    expect(learningPath({ ...exam, courseName: "SAA Bootcamp" })).toBe("Prepared via SAA Bootcamp");
  });
  it("says Self-study for an exam without a course or with a course named after the exam", () => {
    expect(learningPath({ ...exam, courseName: null })).toBe("Self-study");
    expect(learningPath({ ...exam, courseName: "  aws solutions architect associate " })).toBe("Self-study");
  });
  it("returns null (avoiding provider duplicate), or the course, for an exam not started yet", () => {
    expect(learningPath({ ...exam, status: "not_started", courseName: null })).toBeNull();
    expect(learningPath({ ...exam, status: "not_started", courseName: "SAA Bootcamp" })).toBe("Prepared via SAA Bootcamp");
  });
  it("shows the provider of a course completion, but returns null when not started to avoid duplicate", () => {
    expect(learningPath({ certificateKind: "completion", status: "done", certificateName: "ML", courseName: "ML", providerName: "Coursera" })).toBe("Coursera");
    expect(learningPath({ certificateKind: "completion", status: "done", certificateName: "ML", courseName: "ML", providerName: null })).toBeNull();
    expect(learningPath({ certificateKind: "completion", status: "not_started", certificateName: "ML", courseName: "ML", providerName: "Coursera" })).toBeNull();
  });
});
