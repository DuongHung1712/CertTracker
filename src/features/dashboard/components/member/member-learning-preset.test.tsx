// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { MemberDashboardView } from "./member-dashboard-view";

vi.mock("@/features/records/actions", () => ({ createRecord: vi.fn(), updateRecord: vi.fn(), uploadEvidence: vi.fn(), removeEvidence: vi.fn() }));
vi.mock("@/features/learning/actions", () => ({ createLearningItem: vi.fn(), updateLearningItem: vi.fn(), deleteLearningItem: vi.fn(), proposeCourse: vi.fn() }));
vi.mock("@/features/records/components/records-realtime", () => ({ RecordsRealtime: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const EXAM_ID = "5eed0000-0000-0000-0000-00000000e001";
const expiring = makeRecord({
  id: "x", certificateId: EXAM_ID, certificateName: "AWS SAA", status: "done", approval: "approved",
  expiryStatus: "Expiring Soon", daysToExpiry: 20,
});

function view() {
  return (
    <MemberDashboardView
      fullName="Le Minh Chau" teamName={null} careerRoleName={null} yoeYears={null} memberId="m1"
      records={[expiring]} journey={[]} courses={[]} examOptions={[{ id: EXAM_ID, label: "AWS SAA" }]}
      certificateOptions={[]} studyCourses={[]} subtitle="Hello"
    />
  );
}

afterEach(cleanup);

describe("Member dashboard and the journey (decision #72)", () => {
  it("renews an expiring certificate by planning a learning item for that exam", async () => {
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getAllByRole("button", { name: /Renew/ })[0]!);
    expect(screen.getByRole("heading", { name: "Add learning" })).toBeTruthy();
    expect(screen.getByRole<HTMLInputElement>("combobox", { name: /^Exam/ }).value).toBe("AWS SAA");
  });

  it("lists certificates only: no In progress tab, no Mark completed", () => {
    render(view());
    expect(screen.queryByRole("tab", { name: /In progress/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /completed$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Add certificate$/ })).toBeTruthy();
  });
});
