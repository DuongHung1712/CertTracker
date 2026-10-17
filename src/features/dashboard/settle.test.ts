import { afterEach, describe, expect, it, vi } from "vitest";
import { settle } from "@/features/dashboard/settle";

afterEach(() => vi.restoreAllMocks());

describe("settle", () => {
  it("wraps a resolved value", async () => {
    expect(await settle(Promise.resolve(42))).toEqual({ ok: true, data: 42 });
  });
  it("turns a rejection into a generic Vietnamese error and logs only the message", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await settle(Promise.reject(new Error("rpc exploded: secret detail")));
    expect(result).toEqual({ ok: false, error: "Không tải được dữ liệu." });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[1])).toBe("rpc exploded: secret detail");
  });
});
