import { describe, expect, it } from "vitest";
import { toIsoDate, todayVn, toVnDateString } from "@/lib/dates";

describe("toVnDateString", () => {
  it("rolls over to the next day after 17:00 UTC", () => {
    expect(toVnDateString(new Date("2026-09-26T17:30:00Z"))).toBe("2026-09-27");
  });

  it("stays on the same day before 17:00 UTC", () => {
    expect(toVnDateString(new Date("2026-09-26T16:59:59Z"))).toBe("2026-09-26");
  });
});

describe("toIsoDate", () => {
  it("accepts dd/mm/yyyy and single-digit day or month", () => {
    expect(toIsoDate("01/09/2026")).toBe("2026-09-01");
    expect(toIsoDate(" 1/9/2026 ")).toBe("2026-09-01");
  });

  it("passes an ISO date through unchanged (the schema must be idempotent)", () => {
    expect(toIsoDate("2026-09-01")).toBe("2026-09-01");
  });

  it("rejects impossible dates instead of rolling them over", () => {
    expect(toIsoDate("31/02/2026")).toBeNull();
    expect(toIsoDate("29/02/2025")).toBeNull();
    expect(toIsoDate("29/02/2024")).toBe("2024-02-29");
    expect(toIsoDate("04/25/2026")).toBeNull();
  });

  it("rejects two-digit years, out-of-range years and garbage", () => {
    expect(toIsoDate("01/09/26")).toBeNull();
    expect(toIsoDate("01/09/1899")).toBeNull();
    expect(toIsoDate("hôm nay")).toBeNull();
    expect(toIsoDate("")).toBeNull();
  });
});

describe("todayVn", () => {
  it("is the Vietnam calendar date, not the UTC one", () => {
    expect(todayVn(new Date("2026-09-26T17:30:00Z"))).toBe("2026-09-27");
  });
});
