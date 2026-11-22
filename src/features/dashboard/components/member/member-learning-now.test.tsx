// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemberLearningNow, byLearningPriority } from "@/features/dashboard/components/member/member-learning-now";
import { makeRecord } from "@/features/records/__fixtures__/record-row";

const updateLearningProgress = vi.fn();
vi.mock("@/features/learning/actions", () => ({ updateLearningProgress: (...args: unknown[]) => updateLearningProgress(...args) }));
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast: { success: (m: string) => toast.success(m), error: (m: string) => toast.error(m) } }));

const item = (over: Parameters<typeof makeRecord>[0]) =>
  makeRecord({ certificateKind: "exam", expiryStatus: "N/A", daysToExpiry: null, approval: null, ...over });
const studying = item({ id: "a", certificateName: "AWS SAA", status: "in_progress", progress: 30, courseName: "Udemy SAA" });
const waiting = item({ id: "b", certificateName: "CKA", status: "not_started", progress: 0, plannedExamDate: "2026-12-12" });

beforeEach(() => {
  vi.clearAllMocks();
  updateLearningProgress.mockResolvedValue({ ok: true, data: null });
});
afterEach(cleanup);

describe("MemberLearningNow", () => {
  it("lists the open items with their progress, studying first", () => {
    render(<MemberLearningNow items={[waiting, studying]} onAdd={() => {}} />);
    const names = screen.getAllByRole("progressbar").map((bar) => bar.getAttribute("aria-label"));
    expect(names).toEqual(["Progress of AWS SAA", "Progress of CKA"]);
    expect(screen.getByRole("progressbar", { name: "Progress of AWS SAA" }).getAttribute("aria-valuenow")).toBe("30");
    expect(screen.getByText("Prepared via Udemy SAA")).toBeTruthy();
    expect(screen.getByText(/Not started · Exam 12\/12\/2026/)).toBeTruthy();
  });

  it("+10% sends the new value, shows it at once and says so", async () => {
    render(<MemberLearningNow items={[studying]} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add 10% progress to AWS SAA" }));
    expect(updateLearningProgress).toHaveBeenCalledWith({ id: "a", progress: 40 });
    expect(screen.getByRole("progressbar", { name: "Progress of AWS SAA" }).getAttribute("aria-valuenow")).toBe("40");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("AWS SAA: 40%"));
  });

  it("+25% on a not started item starts it", async () => {
    render(<MemberLearningNow items={[waiting]} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add 25% progress to CKA" }));
    expect(updateLearningProgress).toHaveBeenCalledWith({ id: "b", progress: 25 });
  });

  it("stops at 99% and disables the buttons there", async () => {
    render(<MemberLearningNow items={[{ ...studying, progress: 90 }]} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add 25% progress to AWS SAA" }));
    expect(updateLearningProgress).toHaveBeenCalledWith({ id: "a", progress: 99 });
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Add 10% progress to AWS SAA" }).disabled).toBe(true));
  });

  it("puts the old value back and shows the reason when the server refuses", async () => {
    updateLearningProgress.mockResolvedValue({ ok: false, error: "Reload the page and try again." });
    render(<MemberLearningNow items={[studying]} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add 10% progress to AWS SAA" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Reload the page and try again."));
    expect(screen.getByRole("progressbar", { name: "Progress of AWS SAA" }).getAttribute("aria-valuenow")).toBe("30");
  });

  it("with nothing open, says so and still offers Add learning", async () => {
    const onAdd = vi.fn();
    render(<MemberLearningNow items={[]} onAdd={onAdd} />);
    expect(screen.getByText(/Nothing yet/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add learning" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows five and points to the rest", () => {
    const many = Array.from({ length: 7 }, (_, i) => item({ id: `i${i}`, certificateName: `Item ${i}`, status: "in_progress", progress: 10 + i }));
    render(<MemberLearningNow items={many} onAdd={() => {}} />);
    const region = screen.getByRole("region", { name: "Learning now" });
    expect(within(region).getAllByRole("progressbar")).toHaveLength(5);
    expect(within(region).getByRole("link", { name: "View all 7 in My learning" }).getAttribute("href")).toBe("/me?tab=learning");
  });
});

describe("byLearningPriority", () => {
  it("puts studying before not started, the furthest along first, then the soonest exam", () => {
    const a = item({ id: "a", status: "in_progress", progress: 20 });
    const b = item({ id: "b", status: "in_progress", progress: 80 });
    const c = item({ id: "c", status: "not_started", progress: 0, plannedExamDate: "2026-12-30" });
    const d = item({ id: "d", status: "not_started", progress: 0, plannedExamDate: "2026-12-01" });
    expect([a, c, b, d].sort(byLearningPriority).map((r) => r.id)).toEqual(["b", "a", "d", "c"]);
  });
});
