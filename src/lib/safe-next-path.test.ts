import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-next-path";

describe("safeNextPath", () => {
  it.each([
    ["/records", "/records"],
    ["/records?search=AWS", "/records?search=AWS"],
    ["/records?search=Tran&status=expired", "/records?search=Tran&status=expired"],
    ["/import/abc-123", "/import/abc-123"],
    ["/records?search=a%20b", "/records?search=a%20b"],
    ["/", "/"],
    ["/loginx", "/loginx"],
  ])("accepts %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ["//evil.com"],
    ["///evil.com"],
    // Dot segments are resolved by the URL parser and would turn into "//evil.com".
    ["/.//evil.com"],
    ["/a/..//evil.com"],
    ["/%2e//evil.com"],
    ["/%2E%2E//evil.com"],
    ["/records/..//evil.com"],
    ["/_next/static/x"],
    ["/\x5cevil.com"],
    ["/\x5c/evil.com"],
    ["\x5c\x5cevil.com"],
    ["https://evil.com"],
    ["http://evil.com/records"],
    ["javascript:alert(1)"],
    ["data:text/html,x"],
    ["evil.com"],
    ["records"],
    ["/%2F%2Fevil.com"],
    ["/%2f/evil.com"],
    ["/%5Cevil.com"],
    ["/records%0d%0aSet-Cookie:x=1"],
    ["/records\nx"],
    ["/records\tx"],
    ["/\t/evil.com"],
    ["/\u0000"],
    ["/records" + String.fromCharCode(0x2028)],
    ["/%E0%A4%A"],
    ["/login"],
    ["/login?next=/records"],
    ["/LOGIN"],
    ["/Login/"],
    ["/%6Cogin"],
    ["/records/../login"],
    ["/set-password"],
    ["/set-password?token_hash=x"],
    ["/api/cron/notify"],
    [""],
    [" /records"],
    ["/" + "a".repeat(600)],
  ])("rejects %j", (input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it.each([[undefined], [null], [42], [["/records"]], [{}]])("rejects a non-string %j", (input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it("accepts input at the length limit", () => {
    const path = "/" + "a".repeat(511);
    expect(safeNextPath(path)).toBe(path);
  });
});
