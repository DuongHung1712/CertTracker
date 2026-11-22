import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));

import { createUsageStore } from "@/lib/ai/usage-store";

beforeEach(() => {
  rpc.mockReset();
  maybeSingle.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("createUsageStore.claim", () => {
  it("returns the usage id when the database allows the call", async () => {
    rpc.mockResolvedValue({ data: [{ usage_id: "u-1", refusal: null }], error: null });
    expect(await createUsageStore().claim("certificate-reader", "M001")).toEqual({ ok: true, usageId: "u-1" });
    expect(rpc).toHaveBeenCalledWith("claim_ai_call", { p_feature: "certificate-reader", p_member_code: "M001" });
  });
  it.each(["disabled", "daily_limit"] as const)("maps the %s refusal", async (refusal) => {
    rpc.mockResolvedValue({ data: [{ usage_id: null, refusal }], error: null });
    expect(await createUsageStore().claim("certificate-reader", "M001")).toEqual({ ok: false, reason: refusal });
  });
  it("fails closed as disabled on an RPC error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await createUsageStore().claim("certificate-reader", "M001")).toEqual({ ok: false, reason: "disabled" });
  });
  it("fails closed as disabled on an empty answer", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(await createUsageStore().claim("certificate-reader", "M001")).toEqual({ ok: false, reason: "disabled" });
  });
  it("fails closed when the admin client cannot be created", async () => {
    rpc.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY must be set.");
    });
    expect(await createUsageStore().claim("certificate-reader", "M001")).toEqual({ ok: false, reason: "disabled" });
  });
});

describe("createUsageStore.isEnabled", () => {
  it("is true only for an enabled row", async () => {
    maybeSingle.mockResolvedValue({ data: { enabled: true }, error: null });
    expect(await createUsageStore().isEnabled("certificate-reader")).toBe(true);
    maybeSingle.mockResolvedValue({ data: { enabled: false }, error: null });
    expect(await createUsageStore().isEnabled("certificate-reader")).toBe(false);
  });
  it("is false for a missing row or an error", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await createUsageStore().isEnabled("certificate-reader")).toBe(false);
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await createUsageStore().isEnabled("certificate-reader")).toBe(false);
  });
});

describe("createUsageStore.finish", () => {
  it("passes tokens, cost and outcome to the database", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await createUsageStore().finish("u-1", { inputTokens: 1450, outputTokens: 120, costMicroUsd: 579, outcome: "ok" });
    expect(rpc).toHaveBeenCalledWith("finish_ai_call", { p_id: "u-1", p_input: 1450, p_output: 120, p_cost: 579, p_outcome: "ok" });
  });
  it("never throws when the database fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(createUsageStore().finish("u-1", { inputTokens: 0, outputTokens: 0, costMicroUsd: 0, outcome: "timeout" })).resolves.toBeUndefined();
  });
});
