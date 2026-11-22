// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
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

/** The way the table uses it: one mounted sheet that is opened and closed again. */
function Reopenable() {
  const [isOpen, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <LearningSheet open={isOpen} onOpenChange={setOpen} editing={null} fixedMemberId={M} courses={[COURSE]} examOptions={[EXAM]} rows={[]} />
    </>
  );
}

describe("LearningSheet: discarding", () => {
  it("starts the next Add from empty after Cancel and Discard", async () => {
    render(<Reopenable />);
    await userEvent.type(screen.getByRole("textbox", { name: /^Notes/ }), "my study plan");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard" }));
    await userEvent.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: /^Notes/ }).value).toBe("");
    // Nothing is dirty any more, so Cancel closes at once.
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Discard your changes?")).toBeNull();
  });
});

describe("LearningSheet", () => {
  it("starts from an exam, with the course optional for self-study", () => {
    render(sheet());
    expect(screen.getByRole("heading", { name: "Add learning" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "An exam", selected: true })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /^Exam/ })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: /^Course/ }).placeholder).toBe("Self-study (no course)");
    expect(screen.getByRole("textbox", { name: /^Planned exam date/ })).toBeTruthy();
  });

  it("asks for the exam before saving an exam item", async () => {
    const { createLearningItem } = await import("@/features/learning/actions");
    vi.mocked(createLearningItem).mockClear();
    render(sheet());
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    expect(await screen.findByText("Choose the exam you are preparing for")).toBeTruthy();
    expect(createLearningItem).not.toHaveBeenCalled();
  });

  it("saves self-study for an exam with no course", async () => {
    const { createLearningItem } = await import("@/features/learning/actions");
    render(sheet());
    await userEvent.click(screen.getByRole("combobox", { name: /^Exam/ }));
    await userEvent.click(screen.getByRole("option", { name: "AWS SAA" }));
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await vi.waitFor(() =>
      expect(createLearningItem).toHaveBeenCalledWith(expect.objectContaining({ targetCertificateId: EXAM.id, courseId: null })),
    );
  });

  it("a course item has no exam field and a planned finish date", async () => {
    render(sheet());
    await userEvent.click(screen.getByRole("tab", { name: "A course" }));
    expect(screen.queryByRole("combobox", { name: /^Exam/ })).toBeNull();
    expect(screen.getByRole("textbox", { name: /^Planned finish date/ })).toBeTruthy();
  });

  it("warns about an open item for the same course and exam", async () => {
    render(sheet([open]));
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    expect(screen.getByText("You already have an open item for AWS SAA on Udemy. Edit it instead.")).toBeTruthy();
  });

  it("warns about an open item for the same exam, even with another course", async () => {
    render(sheet([{ ...open, courseId: null, courseName: null, targetCertificateId: EXAM.id, targetCertificateName: EXAM.label, isSelfStudy: true }]));
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: /^Exam/ }));
    await userEvent.click(screen.getByRole("option", { name: "AWS SAA" }));
    expect(screen.getByText("You already have an open item for AWS SAA. Edit it instead.")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: /^Save/ }).disabled).toBe(true);
  });

  it("hints when the course is already tracked on its own", async () => {
    render(sheet([open]));
    await userEvent.click(screen.getByRole("combobox", { name: /^Exam/ }));
    await userEvent.click(screen.getByRole("option", { name: "AWS SAA" }));
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    expect(screen.getByText(/You already track AWS SAA on Udemy as a course/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves a course item for the member", async () => {
    const { createLearningItem } = await import("@/features/learning/actions");
    render(sheet());
    await userEvent.click(screen.getByRole("tab", { name: "A course" }));
    await userEvent.click(screen.getByRole("combobox", { name: /^Course/ }));
    await userEvent.click(screen.getByRole("option", { name: /AWS SAA on Udemy/ }));
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await vi.waitFor(() =>
      expect(createLearningItem).toHaveBeenCalledWith(expect.objectContaining({ memberId: M, courseId: COURSE.id, status: "not_started" })),
    );
  });
});

describe("LearningSheet goal and wording", () => {
  it("starts from An exam again after the sheet is closed on A course", async () => {
    const view = render(sheet());
    await userEvent.click(screen.getByRole("tab", { name: "A course" }));
    view.rerender(<LearningSheet open={false} onOpenChange={() => {}} editing={null} fixedMemberId={M} courses={[COURSE]} examOptions={[EXAM]} />);
    view.rerender(sheet());
    expect(screen.getByRole("tab", { name: "An exam", selected: true })).toBeTruthy();
  });

  it("speaks of the member, not you, when a manager adds for someone", async () => {
    render(
      <LearningSheet open onOpenChange={() => {}} editing={null} memberOptions={[{ id: M, label: "Jane" }]} viewerMemberId="5eed0000-0000-0000-0000-00000000b0ff"
        courses={[COURSE]} examOptions={[EXAM]} rows={[{ ...open, courseId: null, courseName: null, targetCertificateId: EXAM.id, targetCertificateName: EXAM.label }]} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: /^Member/ }));
    await userEvent.click(screen.getByRole("option", { name: /Jane/ }));
    await userEvent.click(screen.getByRole("combobox", { name: /^Exam/ }));
    await userEvent.click(screen.getByRole("option", { name: "AWS SAA" }));
    expect(screen.getByText("This member already has an open item for AWS SAA. Edit it instead.")).toBeTruthy();
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
