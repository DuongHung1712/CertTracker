import { describe, expect, it, vi } from "vitest";
import { runBatchAction } from "@/features/import/run-batch-action";
import { err, ok } from "@/lib/result";

function handlers() {
  const calls: string[] = [];
  return {
    calls,
    onOk: vi.fn((data: number) => calls.push(`ok:${data}`)),
    onError: vi.fn((message: string) => calls.push(`error:${message}`)),
    onRejected: vi.fn(() => calls.push("rejected")),
    onSettled: vi.fn(() => calls.push("settled")),
  };
}

describe("runBatchAction", () => {
  it("calls onOk with the data, then onSettled", async () => {
    const h = handlers();
    await runBatchAction(async () => ok(3), h);
    expect(h.calls).toEqual(["ok:3", "settled"]);
  });

  it("calls onError with the server message, then onSettled", async () => {
    const h = handlers();
    await runBatchAction(async () => err("Lô đã được nhập"), h);
    expect(h.calls).toEqual(["error:Lô đã được nhập", "settled"]);
  });

  it("calls onRejected and still onSettled when the action rejects", async () => {
    const h = handlers();
    await runBatchAction(async () => {
      throw new Error("network down");
    }, h);
    expect(h.calls).toEqual(["rejected", "settled"]);
    expect(h.onOk).not.toHaveBeenCalled();
    expect(h.onError).not.toHaveBeenCalled();
  });

  it("calls onRejected when the action throws synchronously", async () => {
    const h = handlers();
    await runBatchAction(() => {
      throw new Error("boom");
    }, h);
    expect(h.calls).toEqual(["rejected", "settled"]);
  });

  it("still settles when a handler throws, and lets that error surface", async () => {
    const h = handlers();
    h.onOk.mockImplementation(() => {
      throw new Error("handler bug");
    });
    await expect(runBatchAction(async () => ok(1), h)).rejects.toThrow("handler bug");
    expect(h.onSettled).toHaveBeenCalledTimes(1);
  });
});
