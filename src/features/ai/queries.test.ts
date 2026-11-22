import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
const createAiGateway = vi.fn();
vi.mock("@/lib/ai/gateway", () => ({ createAiGateway: () => createAiGateway() }));

import { getAiReaderSettings } from "@/features/ai/queries";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: [{ enabled: true, daily_limit: 20, calls_today: 3 }], error: null });
  createAiGateway.mockReset().mockReturnValue({ transport: "deepseek" });
});

describe("getAiReaderSettings", () => {
  it("maps the row and reports the provider", async () => {
    expect(await getAiReaderSettings()).toEqual({ enabled: true, dailyLimit: 20, callsToday: 3, provider: "deepseek" });
    expect(rpc).toHaveBeenCalledWith("get_ai_feature", { p_feature: "certificate-reader" });
  });
  it("reports the fake provider and a missing configuration", async () => {
    createAiGateway.mockReturnValue({ transport: "fake" });
    expect((await getAiReaderSettings())?.provider).toBe("fake");
    createAiGateway.mockImplementation(() => {
      throw new Error("DEEPSEEK_API_KEY is not set.");
    });
    expect((await getAiReaderSettings())?.provider).toBe("not-configured");
  });
  it("is null when the caller is not an admin or the call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only an admin can read this" } });
    expect(await getAiReaderSettings()).toBeNull();
  });
  it("is null when the feature row does not exist", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await getAiReaderSettings()).toBeNull();
  });
});
