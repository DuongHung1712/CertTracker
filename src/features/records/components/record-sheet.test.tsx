// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecordRow } from "@/features/records/queries";
import { RecordSheet } from "@/features/records/components/record-sheet";

// jsdom has no ResizeObserver or scrollIntoView, which the Base UI popups call.
vi.mock("@/features/records/actions", () => ({ createRecord: vi.fn(), updateRecord: vi.fn(), uploadEvidence: vi.fn(), removeEvidence: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const CERTIFICATES = [
  { id: "e1", label: "AWS Associate", kind: "exam" as const, grantingCourse: null },
  { id: "e2", label: "Lonely Exam", kind: "exam" as const, grantingCourse: null },
  { id: "c1", label: "Intro to LLMs", kind: "completion" as const, grantingCourse: { id: "k1", name: "LLM Course" } },
];
const COURSES = [{ id: "k2", name: "AWS Bootcamp", preparesForId: "e1" }];

function sheet() {
  return (
    <RecordSheet
      open
      onOpenChange={() => {}}
      editing={null}
      memberOptions={[]}
      certificateOptions={CERTIFICATES}
      studyCourses={COURSES}
      showCompanyFields={false}
      fixedMemberId="m1"
    />
  );
}

const studied = () => screen.getByRole<HTMLInputElement>("textbox", { name: /Course studied/ });
const certificateInput = (name: RegExp) => screen.getByRole<HTMLInputElement>("combobox", { name });

afterEach(cleanup);

describe("RecordSheet kind choice", () => {
  it("defaults to Exam certificate with the course field disabled until the exam is chosen", () => {
    render(sheet());
    expect(screen.getByRole("tab", { name: "Exam certificate" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("You passed an exam.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add certificate" })).toBeTruthy();
    expect(studied().disabled).toBe(true);
    expect(screen.getByText("Choose the exam first.")).toBeTruthy();
    expect(screen.getByText("Course studied", { exact: false }).textContent).toContain("(optional)");
  });

  it("lists only certificates of the chosen kind", async () => {
    render(sheet());
    await userEvent.click(certificateInput(/^Certificate/));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["AWS Associate", "Lonely Exam"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("tab", { name: "Course completion" }));
    expect(screen.getByRole("heading", { name: "Add course completion" })).toBeTruthy();
    await userEvent.click(certificateInput(/^Course completion/));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Intro to LLMs"]);
  });

  it("exam with preparing courses: enabled with the optional hint", async () => {
    render(sheet());
    await userEvent.click(certificateInput(/^Certificate/));
    await userEvent.click(screen.getByRole("option", { name: "AWS Associate" }));
    expect(screen.getByText("Optional. Pick the course you used, if any.")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Course studied/ }).hasAttribute("disabled")).toBe(false);
  });

  it("exam without a preparing course: disabled, self-study, explained", async () => {
    render(sheet());
    await userEvent.click(certificateInput(/^Certificate/));
    await userEvent.click(screen.getByRole("option", { name: "Lonely Exam" }));
    expect(screen.getByText("No course is listed for this exam. That's fine.")).toBeTruthy();
    const trigger = screen.getByRole("combobox", { name: /Course studied/ });
    expect(trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true").toBe(true);
    expect(trigger.textContent).toContain("None (self-study)");
  });

  it("completion: the granting course is read-only; switching kind clears certificate and course", async () => {
    render(sheet());
    await userEvent.click(screen.getByRole("tab", { name: "Course completion" }));
    expect(screen.getByText("Choose the course completion first.")).toBeTruthy();
    await userEvent.click(certificateInput(/^Course completion/));
    await userEvent.click(screen.getByRole("option", { name: "Intro to LLMs" }));
    // Plain text, still named by its label.
    const course = screen.getByLabelText(/Course studied/);
    expect(course.textContent).toBe("LLM Course");
    expect(course.tagName).toBe("P");

    await userEvent.click(screen.getByRole("tab", { name: "Exam certificate" }));
    expect(certificateInput(/^Certificate/).value).toBe("");
    expect(screen.getByText("Choose the exam first.")).toBeTruthy();
  });

  it("shows the Add-mode hint under Status, and the Catalogue link only when the viewer can add to it", () => {
    const { unmount } = render(sheet());
    expect(screen.getByText("Already passed it? Choose Completed to add the date and your proof.")).toBeTruthy();
    expect(screen.getByText("Can't find yours? Ask your admin to add it.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Add it in the Catalogue" })).toBeNull();
    unmount();
    render(<RecordSheet open onOpenChange={() => {}} editing={null} memberOptions={[]} certificateOptions={CERTIFICATES} studyCourses={COURSES} showCompanyFields canAddToCatalogue />);
    expect(screen.getByRole("link", { name: "Add it in the Catalogue" }).getAttribute("href")).toBe("/courses");
  });

  it("disables Refund status while Registered through the company is off", async () => {
    render(<RecordSheet open onOpenChange={() => {}} editing={null} memberOptions={[]} certificateOptions={CERTIFICATES} studyCourses={COURSES} showCompanyFields />);
    expect(screen.getByRole("combobox", { name: "Refund status" }).hasAttribute("disabled") || screen.getByRole("combobox", { name: "Refund status" }).getAttribute("aria-disabled") === "true").toBe(true);
    await userEvent.click(screen.getByRole("switch", { name: "Registered through the company" }));
    expect(screen.getByRole("combobox", { name: "Refund status" }).getAttribute("aria-disabled")).not.toBe("true");
  });

  describe("refund status of a saved record", () => {
    const record = (viaCompany: boolean) =>
      ({
        id: "r1", memberId: "m1", memberCode: "", memberName: "Jane", memberEmail: "j@x.com", teamId: null, teamName: null, certificateId: "e1", certificateName: "AWS Associate",
        certificateKind: "exam", courseId: null, courseName: null, certTypeName: null, providerName: null, validityMonths: null, cost: null, costCurrency: null, estHours: null,
        status: "in_progress", progress: 10, plannedExamDate: null, issuedDate: null, certificateUrl: null, hasEvidence: false, viaCompany, refundStatus: "pending", notes: null,
        expiryDate: null, daysToExpiry: null, expiryStatus: "N/A", careerRoleName: null, yoeYears: null,
      }) as unknown as RecordRow;
    const open = (viaCompany: boolean) =>
      render(<RecordSheet open onOpenChange={() => {}} editing={record(viaCompany)} memberOptions={[]} certificateOptions={CERTIFICATES} studyCourses={COURSES} showCompanyFields />);
    const refund = () => screen.getByRole("combobox", { name: "Refund status" });

    it("restores the typed value when the company switch goes off and back on before saving", async () => {
      open(true);
      expect(refund().textContent).toContain("Pending");
      await userEvent.click(screen.getByRole("switch", { name: "Registered through the company" }));
      expect(refund().textContent).toContain("Not applicable");
      await userEvent.click(screen.getByRole("switch", { name: "Registered through the company" }));
      expect(refund().textContent).toContain("Pending");
    });

    it("keeps a value left by an import editable while the company switch is off", () => {
      open(false);
      expect(refund().textContent).toContain("Pending");
      expect(refund().getAttribute("aria-disabled")).not.toBe("true");
      expect(refund().hasAttribute("disabled")).toBe(false);
    });
  });

  it("goes back to Exam certificate after the sheet is closed", async () => {
    render(sheet());
    await userEvent.click(screen.getByRole("tab", { name: "Course completion" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("tab", { name: "Exam certificate" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("RecordSheet remembers values across status changes", () => {
  const saved = (partial: Partial<RecordRow>) =>
    ({
      id: "r1", memberId: "m1", memberCode: "", memberName: "Jane", memberEmail: "j@x.com", teamId: null, teamName: null, certificateId: "e1", certificateName: "AWS Associate",
      certificateKind: "exam", courseId: null, courseName: null, certTypeName: null, providerName: null, validityMonths: null, cost: null, costCurrency: null, estHours: null,
      status: "in_progress", progress: 75, plannedExamDate: null, issuedDate: null, certificateUrl: null, hasEvidence: false, viaCompany: false, refundStatus: "n_a", notes: null,
      expiryDate: null, daysToExpiry: null, expiryStatus: "N/A", careerRoleName: null, yoeYears: null, ...partial,
    }) as unknown as RecordRow;
  const open = (editing: RecordRow, presetStatus?: "done") =>
    render(<RecordSheet open onOpenChange={() => {}} editing={editing} presetStatus={presetStatus} memberOptions={[]} certificateOptions={CERTIFICATES} studyCourses={COURSES} showCompanyFields={false} fixedMemberId="m1" />);
  const pick = async (label: string) => {
    await userEvent.click(screen.getByRole("combobox", { name: /^Status/ }));
    await userEvent.click(await screen.findByRole("option", { name: label }));
  };
  const progress = () => screen.getByRole<HTMLInputElement>("spinbutton", { name: /^Progress/ });

  it("restores the progress when the status returns to In progress", async () => {
    open(saved({}));
    expect(progress().value).toBe("75");
    await pick("Not started");
    await pick("In progress");
    expect(progress().value).toBe("75");
    await userEvent.clear(progress());
    await userEvent.type(progress(), "40");
    await pick("Completed");
    await pick("In progress");
    expect(progress().value).toBe("40");
  });

  it("restores the saved progress after Mark completed preset goes back to In progress", async () => {
    open(saved({}), "done");
    await pick("In progress");
    expect(progress().value).toBe("75");
  });
});
