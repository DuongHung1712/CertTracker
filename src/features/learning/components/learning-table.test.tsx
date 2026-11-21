// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningTable } from "@/features/learning/components/learning-table";
import type { LearningRow } from "@/features/learning/queries";

vi.mock("@/features/learning/components/learning-sheet", () => ({ LearningSheet: () => null }));
vi.mock("@/features/learning/actions", () => ({ deleteLearningItem: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const row = (partial: Partial<LearningRow>): LearningRow => ({
  id: "5eed0000-0000-0000-0000-0000000000a1", memberId: "m1", memberCode: "M001", memberName: "Jane", memberEmail: "an@x.vn", teamId: null, teamName: null,
  courseId: null, courseName: null, providerName: null, courseCatalogueStatus: null,
  targetCertificateId: "e1", targetCertificateName: "HSK 3", status: "in_progress", progress: 40,
  plannedDate: "2027-01-15", finishedDate: null, notes: null, isSelfStudy: true, ...partial,
});

afterEach(cleanup);

describe("LearningTable", () => {
  it("shows a self-study item with its exam and progress", () => {
    render(<LearningTable rows={[row({})]} mode="self" fixedMemberId="m1" courses={[]} examOptions={[]} />);
    const cells = within(screen.getAllByRole("row")[1]!).getAllByRole("cell").map((cell) => cell.textContent ?? "");
    expect(cells.join("|")).toContain("Self-study");
    expect(cells.join("|")).toContain("HSK 3");
    expect(cells.join("|")).toContain("40%");
    expect(cells.join("|")).toContain("15/01/2027");
  });

  it("marks a course that is still waiting for the admin", () => {
    render(<LearningTable rows={[row({ courseId: "c1", courseName: "My Coursera ML", courseCatalogueStatus: "pending", isSelfStudy: false })]} mode="self" fixedMemberId="m1" courses={[]} examOptions={[]} />);
    expect(screen.getByText("My Coursera ML")).toBeTruthy();
    expect(screen.getByText(/Awaiting admin approval/)).toBeTruthy();
  });

  it("has no approve action in team mode: learning items are never approved", () => {
    render(<LearningTable rows={[row({})]} mode="team" courses={[]} examOptions={[]} />);
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByText("Jane")).toBeTruthy();
  });
});
