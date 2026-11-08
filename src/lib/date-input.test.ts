import { describe, expect, it } from "vitest";
import { formatDateInput } from "@/lib/date-input";

// R5: the formatter only shapes what is typed or pasted; validation stays in `toIsoDate` / the schema.
describe("formatDateInput", () => {
  it("returns an empty string for an empty value", () => {
    expect(formatDateInput("")).toBe("");
  });

  it.each([
    ["1", "1"],
    ["12", "12"],
    ["123", "12/3"],
    ["1234", "12/34"],
    ["12345", "12/34/5"],
    ["0108202", "01/08/202"],
    ["01082026", "01/08/2026"],
  ])("inserts a slash only when more digits follow: %s -> %s", (raw, formatted) => {
    expect(formatDateInput(raw)).toBe(formatted);
  });

  it("lets backspace remove a slash (no trailing slash is re-added)", () => {
    // Deleting the "3" of "12/3" leaves "12/", which must not stick at "12/".
    expect(formatDateInput("12/")).toBe("12");
    expect(formatDateInput("12/34/")).toBe("12/34");
  });

  it("is stable on an already formatted value", () => {
    expect(formatDateInput("01/08/2026")).toBe("01/08/2026");
    expect(formatDateInput("12/34")).toBe("12/34");
  });

  it("strips non-digits", () => {
    expect(formatDateInput("01a08b2026")).toBe("01/08/2026");
    expect(formatDateInput("01.08.2026")).toBe("01/08/2026");
    expect(formatDateInput("abc")).toBe("");
  });

  it("cuts after 8 digits", () => {
    expect(formatDateInput("010820269")).toBe("01/08/2026");
    expect(formatDateInput("0108202612345")).toBe("01/08/2026");
  });

  it("turns a pasted ISO date into dd/mm/yyyy", () => {
    expect(formatDateInput("2026-08-01")).toBe("01/08/2026");
    expect(formatDateInput("2026-12-31")).toBe("31/12/2026");
  });

  it("keeps a pasted d/m/yyyy working by padding day and month", () => {
    expect(formatDateInput("1/8/2026")).toBe("01/08/2026");
    expect(formatDateInput("1/12/2026")).toBe("01/12/2026");
    expect(formatDateInput("15/8/2026")).toBe("15/08/2026");
  });

  it("does not validate: an impossible date is still formatted", () => {
    expect(formatDateInput("31022026")).toBe("31/02/2026");
    expect(formatDateInput("99999999")).toBe("99/99/9999");
  });
});
