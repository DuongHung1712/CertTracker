// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubmitCertificate, submitTargets } from "@/features/learning/components/submit-certificate";
import type { LearningRow } from "@/features/learning/queries";

// The certificate sheet is tested on its own; here it only reports a save.
vi.mock("@/features/records/components/record-sheet", () => ({
  RecordSheet: (props: { open: boolean; presetCertificateId?: string; onSaved?: (id: string) => void }) =>
    props.open ? (
      <button type="button" onClick={() => props.onSaved?.("r-new")}>
        fake save {props.presetCertificateId}
      </button>
    ) : null,
}));
vi.mock("@/features/certificates/components/propose-certificate-dialog", () => ({
  ProposeCertificateDialog: (props: { open: boolean; defaultName?: string }) => (props.open ? <p>propose {props.defaultName}</p> : null),
}));

const row = (partial: Partial<LearningRow>): LearningRow => ({
  id: "5eed0000-0000-0000-0000-0000000000a1", memberId: "5eed0000-0000-0000-0000-00000000b001", memberCode: "M001", memberName: "Jane", memberEmail: "an@x.vn",
  teamId: null, teamName: null, courseId: null, courseName: null, providerName: null, courseCatalogueStatus: null,
  targetCertificateId: null, targetCertificateName: null, status: "in_progress", progress: 40, plannedDate: null, finishedDate: null,
  notes: null, isSelfStudy: true, ...partial,
});
const COMPLETIONS = new Map([["k1", "cc1"]]);

afterEach(cleanup);

describe("submitTargets", () => {
  it("names the exam, the course's completion certificate, both, or nothing", () => {
    expect(submitTargets(row({ targetCertificateId: "e1" }), COMPLETIONS)).toEqual({ exam: "e1" });
    expect(submitTargets(row({ courseId: "k1" }), COMPLETIONS)).toEqual({ completion: "cc1" });
    expect(submitTargets(row({ courseId: "k1", targetCertificateId: "e1" }), COMPLETIONS)).toEqual({ exam: "e1", completion: "cc1" });
    expect(submitTargets(row({ courseId: "k2" }), COMPLETIONS)).toEqual({});
  });
});

describe("SubmitCertificate", () => {
  const show = (item: LearningRow) =>
    render(<SubmitCertificate row={item} onClose={() => {}} certificateOptions={[]} studyCourses={[]} completionByCourse={COMPLETIONS} />);

  it("opens the certificate sheet preset with the exam (the database then completes the item)", () => {
    show(row({ targetCertificateId: "e1" }));
    expect(screen.getByRole("button", { name: /fake save e1/ })).toBeTruthy();
  });

  it("asks which certificate when the item has both a course and an exam", async () => {
    show(row({ courseId: "k1", targetCertificateId: "e1" }));
    await userEvent.click(screen.getByRole("button", { name: "Course certificate" }));
    expect(screen.getByRole("button", { name: /fake save cc1/ })).toBeTruthy();
  });

  it("proposes the completion certificate when the course has none yet", () => {
    show(row({ courseId: "k2", courseName: "My Coursera ML" }));
    expect(screen.getByText("propose My Coursera ML")).toBeTruthy();
  });
});
