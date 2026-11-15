// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { MemberDashboardView } from "./member-dashboard-view";

vi.mock("@/features/records/actions", () => ({ createRecord: vi.fn(), updateRecord: vi.fn(), uploadEvidence: vi.fn(), removeEvidence: vi.fn() }));
vi.mock("@/features/records/components/records-realtime", () => ({ RecordsRealtime: () => null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const studying = makeRecord({
  id: "p", certificateName: "Course Studying", status: "in_progress", progress: 40,
  issuedDate: null, expiryDate: null, daysToExpiry: null, expiryStatus: "N/A",
});

function view() {
  return (
    <MemberDashboardView
      fullName="Le Minh Chau" teamName={null} careerRoleName={null} yoeYears={null} memberId="m1"
      records={[studying]} certificateOptions={[]} studyCourses={[]} subtitle="Hello"
    />
  );
}

afterEach(cleanup);

describe("Mark completed preset", () => {
  it("opens the sheet with Completed (progress hidden, forced to 100) and a later Edit shows the saved status again", async () => {
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole("button", { name: "Mark Course Studying completed" }));
    expect(screen.getByRole("combobox", { name: /Status/ }).textContent).toContain("Completed");
    expect(screen.queryByLabelText(/Progress/)).toBeNull();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Edit Course Studying" }));
    expect(screen.getByRole("combobox", { name: /Status/ }).textContent).toContain("In progress");
    expect((screen.getByLabelText(/Progress/) as HTMLInputElement).value).toBe("40");
  });

  it("clears the preset on Add", async () => {
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole("button", { name: "Mark Course Studying completed" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /^Add certificate or course completion/ }));
    expect(screen.getByRole("combobox", { name: /Status/ }).textContent).toContain("Not started");
  });
});
