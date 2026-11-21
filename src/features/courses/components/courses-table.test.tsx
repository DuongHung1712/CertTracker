// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoursesTable } from "@/features/courses/components/courses-table";

vi.mock("@/features/courses/actions", () => ({
  deleteCourse: vi.fn(),
  approveCourse: vi.fn(async () => ({ ok: true, data: null })),
  rejectCourse: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("@/features/courses/components/course-sheet", () => ({ CourseSheet: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const course = {
  id: "00000000-0000-0000-0000-0000000000c1", name: "My Coursera ML", providerId: null, providerName: "Coursera", preparesForId: null,
  preparesForName: null, grantsCertificateName: null, refundable: false, cost: null, costCurrency: null, estHours: null, url: null,
  refundConditions: null, catalogueStatus: "pending" as const,
};

afterEach(cleanup);

describe("CoursesTable proposals (decision #72)", () => {
  it("has no Prepares for column", () => {
    render(<CoursesTable courses={[{ ...course, catalogueStatus: "approved" }]} providers={[]} certTypes={[]} canManage />);
    expect(screen.queryByRole("columnheader", { name: /Prepares for/ })).toBeNull();
  });

  it("marks a proposed course and lets the admin approve it with its completion certificate", async () => {
    const { approveCourse } = await import("@/features/courses/actions");
    render(<CoursesTable courses={[course]} providers={[]} certTypes={[]} canManage />);
    expect(screen.getByText("Awaiting admin approval")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Actions for My Coursera ML" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Approve" }));
    await vi.waitFor(() => expect(approveCourse).toHaveBeenCalledWith({ id: course.id, grantsCompletion: true }));
  });
});
