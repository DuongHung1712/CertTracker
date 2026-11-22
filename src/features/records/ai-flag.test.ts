import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const isEnabled = vi.fn();
vi.mock("@/lib/ai/usage-store", () => ({ createUsageStore: () => ({ isEnabled }) }));
const createAiGateway = vi.fn();
vi.mock("@/lib/ai/gateway", () => ({ createAiGateway: () => createAiGateway() }));

import { isAiReaderEnabled } from "@/features/records/ai-flag";

beforeEach(() => {
  isEnabled.mockReset().mockResolvedValue(true);
  createAiGateway.mockReset().mockReturnValue({});
});

describe("isAiReaderEnabled", () => {
  it("is true when the gateway is configured and the flag is on", async () => {
    expect(await isAiReaderEnabled()).toBe(true);
    expect(isEnabled).toHaveBeenCalledWith("certificate-reader");
  });
  it("is false when the flag is off", async () => {
    isEnabled.mockResolvedValue(false);
    expect(await isAiReaderEnabled()).toBe(false);
  });
  it("is false, not an error, when the gateway is misconfigured", async () => {
    createAiGateway.mockImplementation(() => {
      throw new Error("AI_TRANSPORT is not set.");
    });
    expect(await isAiReaderEnabled()).toBe(false);
    expect(isEnabled).not.toHaveBeenCalled();
  });
});
