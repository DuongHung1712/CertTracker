// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { updateRecord } from "@/features/records/actions";
import type { RecordRow } from "@/features/records/queries";
import type { CertificateChoice } from "@/features/records/certificate-course";
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

const certificateInput = (name: RegExp) => screen.getByRole<HTMLInputElement>("combobox", { name });

afterEach(cleanup);

describe("RecordSheet kind choice", () => {
  it("defaults to Exam certificate", () => {
    render(sheet());
    expect(screen.getByRole("tab", { name: "Exam certificate" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Official certifications validated by an exam (AWS, Azure, CKA, PMP...)")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Add certificate" })).toBeTruthy();
  });

  it("lists only certificates of the chosen kind", async () => {
    render(sheet());
    await userEvent.click(certificateInput(/^Certificate/));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["AWS Associate", "Lonely Exam"]);
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByRole("tab", { name: "Course certificate" }));
    expect(screen.getByRole("heading", { name: "Add certificate" })).toBeTruthy();
    await userEvent.click(certificateInput(/^Course certificate/));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Intro to LLMs"]);
  });

  it("shows the Catalogue link only when the viewer can add to it", () => {
    const { unmount } = render(sheet());
    expect(screen.getByText("Can't find yours?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "+ Propose a new certificate" })).toBeTruthy();
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
    await userEvent.click(screen.getByRole("tab", { name: "Course certificate" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("tab", { name: "Exam certificate" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("RecordSheet returned note", () => {
  const row = (partial: Partial<RecordRow>) =>
    ({
      id: "r1", memberId: "m1", memberCode: "", memberName: "Jane", memberEmail: "j@x.com", teamId: null, teamName: null, certificateId: "e1", certificateName: "AWS Associate",
      certificateKind: "exam", courseId: null, courseName: null, certTypeName: null, providerName: null, validityMonths: null, cost: null, costCurrency: null, estHours: null,
      status: "done", progress: 100, plannedExamDate: null, issuedDate: "2026-01-02", certificateUrl: null, hasEvidence: false, viaCompany: false, refundStatus: "n_a", notes: null,
      expiryDate: null, daysToExpiry: null, expiryStatus: "N/A", approval: "returned", approvalNote: "Wrong date.", ...partial,
    }) as unknown as RecordRow;
  const open = (editing: RecordRow, showCompanyFields: boolean, viewerMemberId: string | null = "m1") =>
    render(<RecordSheet open onOpenChange={() => {}} editing={editing} memberOptions={[]} certificateOptions={CERTIFICATES} studyCourses={COURSES} showCompanyFields={showCompanyFields} fixedMemberId="m1" viewerMemberId={viewerMemberId} />);

  it("shows the manager's note to the member", () => {
    open(row({}), false);
    expect(screen.getByRole("alert").textContent).toBe("Returned for changes: Wrong date. Fix it and save to send it again.");
  });

  it("a reviewer on someone else's item sees the reviewer wording", () => {
    open(row({}), true, "boss");
    expect(screen.getByRole("alert").textContent).toBe("Returned to the member: Wrong date. The member fixes it and saves to send it again.");
  });

  it("a manager on their OWN item is treated as the member, and nothing shows when not returned", () => {
    open(row({}), true, "m1");
    expect(screen.getByRole("alert").textContent).toContain("Fix it and save");
    cleanup();
    cleanup();
    open(row({ approval: "waiting", approvalNote: null }), false);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("RecordSheet save toast", () => {
  const GUID_M = "5eed0000-0000-0000-0000-00000000b001";
  const GUID_E = "5eed0000-0000-0000-0000-00000000d001";
  const done = {
    id: "r1", memberId: GUID_M, memberCode: "", memberName: "Jane", memberEmail: "j@x.com", teamId: null, teamName: null, certificateId: GUID_E, certificateName: "AWS Associate",
    certificateKind: "exam", courseId: null, courseName: null, certTypeName: null, providerName: null, validityMonths: null, cost: null, costCurrency: null, estHours: null,
    status: "done", progress: 100, plannedExamDate: null, issuedDate: "2026-01-02", certificateUrl: null, hasEvidence: false, viaCompany: false, refundStatus: "n_a", notes: null,
    expiryDate: null, daysToExpiry: null, expiryStatus: "N/A", approval: "approved", approvalNote: null,
  } as unknown as RecordRow;

  it.each([
    ["waiting", "Saved certificate. It is waiting for approval."],
    ["approved", "Saved certificate"],
  ] as const)("says what the database decided: %s", async (approval, message) => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(updateRecord).mockResolvedValue({ ok: true, data: { approval } });
    render(<RecordSheet open onOpenChange={() => {}} editing={done} memberOptions={[]} certificateOptions={[{ id: GUID_E, label: "AWS Associate", kind: "exam", grantingCourse: null }]} studyCourses={COURSES} showCompanyFields={false} fixedMemberId={GUID_M} />);
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith(message));
  });
});

describe("RecordSheet renewal duplicate detection", () => {
  const existingDone = {
    id: "r1",
    memberId: "m1",
    certificateId: "e1",
    certificateName: "AWS Associate",
    certificateKind: "exam",
    status: "done",
    issuedDate: "2024-01-01",
    progress: 100,
  } as unknown as RecordRow;

  it("allows adding a renewed certificate when a done record already exists", async () => {
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={null}
        memberOptions={[]}
        certificateOptions={CERTIFICATES}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
        records={[existingDone]}
      />,
    );
    await userEvent.click(certificateInput(/^Certificate/));
    await userEvent.click(screen.getByRole("option", { name: "AWS Associate" }));
    // Duplicate message must NOT appear, and Save button must be enabled
    expect(screen.queryByText(/is already on this list/)).toBeNull();
    const saveButton = screen.getByRole("button", { name: /^Save/ });
    expect(saveButton.hasAttribute("disabled")).toBe(false);
  });

  it("blocks a second certificate with the same issue date", async () => {
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={null}
        memberOptions={[]}
        certificateOptions={CERTIFICATES}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
        records={[existingDone]}
      />,
    );
    await userEvent.click(certificateInput(/^Certificate/));
    await userEvent.click(screen.getByRole("option", { name: "AWS Associate" }));
    await userEvent.type(screen.getByRole("textbox", { name: /Date passed/ }), "01/01/2024");

    expect(screen.getByText("AWS Associate is already on this list. Edit it instead.")).toBeTruthy();
    const saveButton = screen.getByRole("button", { name: /^Save/ });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
  });
});

describe("RecordSheet proposal and delete", () => {
  it("renders '+ Propose a new certificate' button and opens proposal dialog", async () => {
    render(sheet());
    const proposeBtn = screen.getByRole("button", { name: "+ Propose a new certificate" });
    expect(proposeBtn).toBeTruthy();
    await userEvent.click(proposeBtn);
    expect(await screen.findByRole("heading", { name: /Propose a new certificate/ })).toBeTruthy();
  });

  it("shows Delete button in footer when editing an in-progress draft record", () => {
    const draft = makeRecord({ id: "r-draft", status: "in_progress", certificateName: "Draft Cert" });
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={draft}
        memberOptions={[]}
        certificateOptions={CERTIFICATES}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
      />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("shows Delete button in footer when editing a returned record even with canDelete=false", () => {
    const returned = makeRecord({ id: "r-ret", status: "done", approval: "returned", approvalNote: "fix dates", certificateName: "Returned Cert" });
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={returned}
        memberOptions={[]}
        certificateOptions={CERTIFICATES}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
        canDelete={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy();
  });

  it("does not show Delete button in footer when editing an approved completed record without delete permission", () => {
    const approved = makeRecord({ id: "r-appr", status: "done", approval: "approved", certificateName: "Approved Cert" });
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={approved}
        memberOptions={[]}
        certificateOptions={CERTIFICATES}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
        canDelete={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("renders Pending Approval badge and note when a pending certificate is selected", () => {
    const pendingCert: CertificateChoice = {
      id: "c-pending",
      label: "Pending AWS Specialty",
      kind: "exam",
      grantingCourse: null,
      catalogueStatus: "pending",
    };
    render(
      <RecordSheet
        open
        onOpenChange={() => {}}
        editing={null}
        memberOptions={[]}
        certificateOptions={[...CERTIFICATES, pendingCert]}
        studyCourses={COURSES}
        showCompanyFields={false}
        fixedMemberId="m1"
        presetCertificateId="c-pending"
      />,
    );
    expect(screen.getByText("Awaiting admin approval")).toBeTruthy();
    expect(screen.getByText(/This item is pending admin approval/)).toBeTruthy();
  });
});

describe("RecordSheet is for certificates only (decision #72)", () => {
  it("has no Status, Progress or Preparation course field and says Add certificate for both kinds", async () => {
    render(sheet());
    expect(screen.queryByRole("combobox", { name: /^Status/ })).toBeNull();
    expect(screen.queryByLabelText(/Progress/)).toBeNull();
    expect(screen.queryByText(/Preparation course/)).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Course certificate" }));
    expect(screen.getByRole("heading", { name: "Add certificate" })).toBeTruthy();
  });

  it("saves a new certificate as Completed with progress 100", async () => {
    const { createRecord } = await import("@/features/records/actions");
    vi.mocked(createRecord).mockResolvedValue({ ok: true, data: { id: "r9", approval: "waiting" } });
    const GUID_M = "5eed0000-0000-0000-0000-00000000b001";
    const GUID_E = "5eed0000-0000-0000-0000-00000000d001";
    render(<RecordSheet open onOpenChange={() => {}} editing={null} memberOptions={[]} certificateOptions={[{ id: GUID_E, label: "AWS Associate", kind: "exam", grantingCourse: null }]} studyCourses={COURSES} showCompanyFields={false} fixedMemberId={GUID_M} />);
    await userEvent.click(certificateInput(/^Certificate/));
    await userEvent.click(screen.getByRole("option", { name: "AWS Associate" }));
    await userEvent.type(screen.getByRole("textbox", { name: /Date passed/ }), "01/10/2026");
    await userEvent.click(screen.getByRole("button", { name: /^Save/ }));
    await vi.waitFor(() =>
      expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ certificateId: GUID_E, status: "done", progress: 100 })),
    );
  });
});
