// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningSheet } from "@/features/learning/components/learning-sheet";
import type { LearningRow } from "@/features/learning/queries";

vi.mock("@/features/learning/actions", () => ({
  createLearningItem: vi.fn(async () => ({ ok: true, data: { id: "n1" } })),
  updateLearningItem: vi.fn(async () => ({ ok: true, data: null })),
  deleteLearningItem: vi.fn(),
  proposeCourse: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const M = "5eed0000-0000-0000-0000-00000000b001";
const COURSE = { id: "5eed0000-0000-0000-0000-00000000c001", label: "AWS SAA on Udemy", hint: "Udemy", catalogueStatus: "approved" as const };
const EXAM = { id: "5eed0000-0000-0000-0000-00000000e001", label: "AWS SAA" };

const open: LearningRow = {
  id: "5eed0000-0000-0000-0000-0000000000a1", memberId: M, memberCode: "M001", memberName: "Jane", memberEmail: "an@x.vn", teamId: null, teamName: null,
  courseId: COURSE.id, courseName: COURSE.label, providerName: "Udemy", courseCatalogueStatus: "approved",
  targetCertificateId: null, targetCertificateName: null, status: "in_progress", progress: 30,
  plannedDate: null, finishedDate: null, notes: null, isSelfStudy: false,
};

const sheet = (rows: LearningRow[] = []) => (
  <LearningSheet open onOpenChange={() => {}} editing={null} fixedMemberId={M} courses={[COURSE]} examOptions={[EXAM]} rows={rows} />
);

afterEach(cleanup);

describe("LearningSheet", () => {
  it("asks for a course, an exam, or both", () => {
    render(sheet());
    expect(screen.getByRole("heading", { name: "Add learning" })).toBeTruthy();
    expect(screen.getByText("Pick a course, an exam, or both.")).toBeTruthy();
  });

  it("calls the planned date a planned exam date once an exam is chosen", async () => {
    render(sheet());
    expect(screen.getByRole("textbox", { name: /^Planned finish date/ })).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox", { name: /^Exam you are preparing for/ }));
    await userEvent.click(screen.getByRole("option", { name: "AWS SAA" }));
    expect(screen.getByRole("textbox", { name: /^Planned exam date/ })).toBeTruthy();
  });

  it("warns about an open item for the same course and exam", async () => {
    render(sheet([open]));
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    expect(screen.getByText("You already have an open item for this. Edit it instead.")).toBeTruthy();
  });

  it("saves a new item for the member", async () => {
    const { createLearningItem } = await import("@/features/learning/actions");
    render(sheet());
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await vi.waitFor(() =>
      expect(createLearningItem).toHaveBeenCalledWith(expect.objectContaining({ memberId: M, courseId: COURSE.id, status: "not_started" })),
    );
  });
});

describe("LearningSheet propose a course", () => {
  it("proposes a missing course and selects it", async () => {
    const { proposeCourse } = await import("@/features/learning/actions");
    vi.mocked(proposeCourse).mockResolvedValue({ ok: true, data: { id: "5eed0000-0000-0000-0000-00000000c0ff" } });
    render(<LearningSheet open onOpenChange={() => {}} editing={null} fixedMemberId={M} viewerMemberId={M} courses={[COURSE]} examOptions={[EXAM]} />);
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.keyboard("My Coursera ML");
    await userEvent.click(await screen.findByRole("button", { name: /Propose a new course/ }));
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /^Course name/ }).value).toBe("My Coursera ML");
    await userEvent.type(screen.getByRole("textbox", { name: /^Provider/ }), "Coursera");
    await userEvent.click(screen.getByRole("button", { name: "Propose" }));
    await vi.waitFor(() => expect(proposeCourse).toHaveBeenCalledWith({ name: "My Coursera ML", proposedProvider: "Coursera", memberId: M }));
    await vi.waitFor(() => expect(screen.getByRole<HTMLInputElement>("combobox", { name: /^Course/ }).value).toBe("My Coursera ML"));
  });
});

describe("LearningSheet propose links are always visible", () => {
  it("offers Propose a new course and Propose a new exam without searching first", () => {
    render(<LearningSheet open onOpenChange={() => {}} editing={null} fixedMemberId={M} viewerMemberId={M} courses={[COURSE]} examOptions={[EXAM]} />);
    expect(screen.getByRole("button", { name: "+ Propose a new course" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Propose a new exam" })).toBeTruthy();
  });
});
