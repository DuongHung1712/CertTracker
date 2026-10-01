import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupPartialBatch } from "@/features/import/cleanup";

afterEach(() => vi.restoreAllMocks());

describe("cleanupPartialBatch", () => {
  it("does not touch the discard fallback when the delete works", async () => {
    const remove = vi.fn().mockResolvedValue(true);
    const discard = vi.fn().mockResolvedValue(true);
    await cleanupPartialBatch("b1", { remove, discard });
    expect(remove).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
  });

  it("marks the batch discarded when the delete reports a failure", async () => {
    const remove = vi.fn().mockResolvedValue(false);
    const discard = vi.fn().mockResolvedValue(true);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await cleanupPartialBatch("b1", { remove, discard });
    expect(discard).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it("marks the batch discarded when the delete throws", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("network down"));
    const discard = vi.fn().mockResolvedValue(true);
    await cleanupPartialBatch("b1", { remove, discard });
    expect(discard).toHaveBeenCalledOnce();
  });

  it("logs only the batch id, and does not throw, when both steps fail", async () => {
    const remove = vi.fn().mockRejectedValue(new Error("secret detail 1"));
    const discard = vi.fn().mockRejectedValue(new Error("secret detail 2"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(cleanupPartialBatch("b-42", { remove, discard })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
    const message = String(log.mock.calls[0]?.[0]);
    expect(message).toContain("b-42");
    expect(message).not.toContain("secret");
  });
});
