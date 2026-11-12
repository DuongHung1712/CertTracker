// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeRecord } from "@/features/records/__fixtures__/record-row";
import { RecordsTable } from "@/features/records/components/records-table";

// The sheet and the delete action pull in server actions; neither is part of what these tests look at.
vi.mock("@/features/records/components/record-sheet", () => ({ RecordSheet: () => null }));
vi.mock("@/features/records/actions", () => ({ deleteRecord: vi.fn() }));

const RECORDS = [
  makeRecord({ id: "e1", certificateName: "AWS Solutions Architect", certificateKind: "exam" }),
  makeRecord({ id: "c1", certificateName: "Intro to Terraform", certificateKind: "completion" }),
  makeRecord({ id: "c2", certificateName: "Kubernetes Basics", certificateKind: "completion" }),
];

const table = (mode: "self" | "team", records = RECORDS) => (
  <RecordsTable
    records={records}
    memberOptions={[{ id: "m1", label: "Le Minh Chau" }]}
    certificateOptions={[{ id: "c", label: "AWS", kind: "exam", grantingCourse: null }]}
    studyCourses={[]}
    mode={mode}
    canDelete={false}
    showCompanyFields={false}
  />
);

const rowNames = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent ?? "");

afterEach(cleanup);

describe("RecordsTable kind filter", () => {
  it("self mode: tabs with counts narrow the list to one kind", async () => {
    render(table("self"));
    expect(screen.getByRole("tab", { name: "All (3)" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Exam certificates (1)" })).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Course completions (2)" }));
    expect(rowNames().join("|")).toContain("Intro to Terraform");
    expect(rowNames().join("|")).not.toContain("AWS Solutions Architect");

    await userEvent.click(screen.getByRole("tab", { name: "Exam certificates (1)" }));
    expect(rowNames()).toHaveLength(1);
  });

  it("self mode: names the planned date by the chosen kind and offers the add action for both kinds", async () => {
    render(table("self"));
    expect(screen.getByRole("columnheader", { name: "Planned date" })).toBeTruthy();
    await userEvent.click(screen.getByRole("tab", { name: "Course completions (2)" }));
    expect(screen.getByRole("columnheader", { name: "Planned finish date" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add certificate or course completion" })).toBeTruthy();
    expect(screen.getByText("Studying for an exam? Choose the exam, then the course you used.")).toBeTruthy();
  });

  it("team mode: a Kind select, not tabs", async () => {
    render(table("team"));
    expect(screen.queryByRole("tab")).toBeNull();
    await userEvent.click(screen.getByRole("combobox", { name: "Kind" }));
    await userEvent.click(await screen.findByRole("option", { name: "Course completions" }));
    expect(rowNames().join("|")).not.toContain("AWS Solutions Architect");
    expect(rowNames()).toHaveLength(2);
  });

  it("Clear filters resets the kind", async () => {
    render(table("self"));
    await userEvent.click(screen.getByRole("tab", { name: "Course completions (2)" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(rowNames()).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "All (3)" }).getAttribute("aria-selected")).toBe("true");
  });
});
