import { describe, expect, it } from "vitest";
import { capMessages, capRaw, MAX_STORED_TEXT, sanitizeJson, truncateText } from "@/features/import/stored";

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("abc")).toBe("abc");
    expect(truncateText("a".repeat(MAX_STORED_TEXT))).toBe("a".repeat(MAX_STORED_TEXT));
  });

  it("cuts long text and marks it with an ellipsis", () => {
    expect(truncateText("x".repeat(40_000))).toBe(`${"x".repeat(MAX_STORED_TEXT)}…`);
  });

  it("never leaves a lone surrogate when the cut splits an emoji", () => {
    const out = truncateText("😀".repeat(400), 3); // 3 units: one emoji plus half of the next
    expect(out.isWellFormed()).toBe(true);
    expect(out.endsWith("…")).toBe(true);
  });

  it("drops NUL, which Postgres jsonb cannot store", () => {
    expect(truncateText("a\u0000b")).toBe("ab");
  });
});

describe("capRaw", () => {
  it("caps string cells, keeps numbers/booleans/nulls and caps the display fields", () => {
    const big = "y".repeat(10_000);
    const raw = capRaw({ cells: { Tên: big, SL: 5, Ok: true, Trống: null }, email: big, course: null });
    expect(raw.cells["Tên"]).toHaveLength(MAX_STORED_TEXT + 1);
    expect(raw.cells).toMatchObject({ SL: 5, Ok: true, Trống: null });
    expect(raw.email).toHaveLength(MAX_STORED_TEXT + 1);
    expect(raw.course).toBeNull();
  });

  it("keeps the first of two headers that collide after capping, without throwing", () => {
    const header = "h".repeat(2000);
    const raw = capRaw({ cells: { [header]: "first", [`${header}2`]: "second" }, email: null, course: null });
    expect(Object.values(raw.cells)).toEqual(["first"]);
  });
});

describe("capMessages", () => {
  it("caps each message", () => {
    expect(capMessages(["ok", "z".repeat(5000)]).map((m) => m.length)).toEqual([2, MAX_STORED_TEXT + 1]);
  });
});

describe("sanitizeJson", () => {
  it("strips NUL and lone surrogates from nested strings and keys, keeping everything else", () => {
    const input = { member: { fullName: "A\u0000B", n: 3, ok: true, none: null }, list: ["x\ud800y", 1], "k\u0000ey": "v" };
    expect(sanitizeJson(input)).toEqual({ member: { fullName: "AB", n: 3, ok: true, none: null }, list: ["x�y", 1], key: "v" });
  });
});
