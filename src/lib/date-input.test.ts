import { describe, expect, it } from "vitest";
import { formatDateInput } from "@/lib/date-input";

// R5 as amended by R14: the formatter only shapes what is typed or pasted; validation stays in `toIsoDate` / the schema.

/** Feeds `keys` one at a time, each time formatting the current value plus the new key, as the input does. */
const typeKeys = (keys: string, start = "") => [...keys].reduce((value, key) => formatDateInput(value + key), start);
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

  it("lets backspace work one character at a time (R14: a slash the user left is kept, never re-added)", () => {
    // Deleting the "3" of "12/3" leaves "12/"; the next Backspace removes the slash itself.
    expect(formatDateInput("12/")).toBe("12/");
    expect(formatDateInput("12/34/")).toBe("12/34/");
    // Every prefix of a full date is left as it is, so deleting from the end never fights the user.
    const full = "01/08/2026";
    for (let end = 0; end <= full.length; end++) expect(formatDateInput(full.slice(0, end))).toBe(full.slice(0, end));
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

  it("R14: typing d/m/yyyy key by key pads day and month once the next part starts", () => {
    expect(typeKeys("1/8/2026")).toBe("01/08/2026");
    expect(formatDateInput("1/")).toBe("01/");
    expect(formatDateInput("01/8/")).toBe("01/08/");
    expect(formatDateInput("01/9/2026")).toBe("01/09/2026");
    // A part still being typed is left alone.
    expect(formatDateInput("01/8")).toBe("01/8");
  });

  it("R14: typing digits only key by key still gives dd/mm/yyyy", () => {
    expect(typeKeys("01082026")).toBe("01/08/2026");
    expect(typeKeys("010820269")).toBe("01/08/2026");
    // After the mask has inserted a slash, the next digit flows into the next part.
    expect(formatDateInput("01/082")).toBe("01/08/2");
  });

  it("R14: a lone 0 is not padded, so a digit can be replaced mid-string", () => {
    // Deleting the 8 of 01/08/2026 leaves room to type the new month digit.
    expect(formatDateInput("01/0/2026")).toBe("01/0/2026");
    expect(formatDateInput("0/08/2026")).toBe("0/08/2026");
    expect(formatDateInput("0/")).toBe("0/");
  });

  it("R14: strips letters in a value with slashes", () => {
    expect(formatDateInput("1a/8/2026")).toBe("01/08/2026");
    expect(formatDateInput("01/0b8/2026")).toBe("01/08/2026");
  });

  it("R14: trims surrounding spaces before anything else", () => {
    expect(formatDateInput(" 2026-08-01")).toBe("01/08/2026");
    expect(formatDateInput("2026-08-01 ")).toBe("01/08/2026");
    expect(formatDateInput(" 01082026 ")).toBe("01/08/2026");
  });

  it("does not validate: an impossible date is still formatted", () => {
    expect(formatDateInput("31022026")).toBe("31/02/2026");
    expect(formatDateInput("99999999")).toBe("99/99/9999");
  });
});
