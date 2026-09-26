import { describe, expect, it } from "vitest";
import { toVnDateString } from "@/lib/dates";

describe("toVnDateString", () => {
  it("rolls over to the next day after 17:00 UTC", () => {
    expect(toVnDateString(new Date("2026-09-26T17:30:00Z"))).toBe("2026-09-27");
  });

  it("stays on the same day before 17:00 UTC", () => {
    expect(toVnDateString(new Date("2026-09-26T16:59:59Z"))).toBe("2026-09-26");
  });
});
