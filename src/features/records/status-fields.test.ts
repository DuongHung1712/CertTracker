import { describe, expect, it } from "vitest";
import { valuesOnStatusChange, visibleFields } from "@/features/records/status-fields";

// R1 + R11: which status-dependent fields the certificate form renders (Notes is role based, not part of this).
describe("visibleFields", () => {
  it("Not started shows only the planned exam date", () => {
    expect(visibleFields("not_started")).toEqual({
      progress: false,
      plannedExamDate: true,
      issuedDate: false,
      certificateUrl: false,
      evidence: false,
    });
  });

  it("In progress shows progress and the planned exam date", () => {
    expect(visibleFields("in_progress")).toEqual({
      progress: true,
      plannedExamDate: true,
      issuedDate: false,
      certificateUrl: false,
      evidence: false,
    });
  });

  it("Completed shows the issue date and the certificate link", () => {
    expect(visibleFields("done")).toEqual({
      progress: false,
      plannedExamDate: false,
      issuedDate: true,
      certificateUrl: true,
      evidence: true,
    });
  });
});

it("R10: Notes is not a status-dependent field", () => {
  for (const status of ["not_started", "in_progress", "done"] as const) expect(visibleFields(status)).not.toHaveProperty("notes");
});

// R2: values set or cleared when the status changes (order of `clear` is not part of the contract).
describe("valuesOnStatusChange", () => {
  const sorted = (result: { progress: number; clear: string[] }) => ({ ...result, clear: [...result.clear].sort() });

  it.each([0, 40, 100])("to Completed from progress %i sets 100 and clears the planned exam date", (progress) => {
    expect(sorted(valuesOnStatusChange("done", { progress }))).toEqual({ progress: 100, clear: ["plannedExamDate"] });
  });

  it.each([0, 40, 100])("to Not started from progress %i sets 0 and clears issue date and link", (progress) => {
    expect(sorted(valuesOnStatusChange("not_started", { progress }))).toEqual({
      progress: 0,
      clear: ["certificateUrl", "issuedDate"],
    });
  });

  it.each([
    [0, 0],
    [40, 40],
    [100, 0],
  ])("to In progress from progress %i gives %i and clears issue date and link", (progress, expected) => {
    expect(sorted(valuesOnStatusChange("in_progress", { progress }))).toEqual({
      progress: expected,
      clear: ["certificateUrl", "issuedDate"],
    });
  });

  it("keeps an in-between progress such as 99 when going to In progress", () => {
    expect(valuesOnStatusChange("in_progress", { progress: 99 }).progress).toBe(99);
  });
});
