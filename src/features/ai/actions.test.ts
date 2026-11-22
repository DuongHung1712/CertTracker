import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (path: string) => revalidatePath(path) }));

import { saveAiReaderSettings } from "@/features/ai/actions";

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
  revalidatePath.mockReset();
});

describe("saveAiReaderSettings", () => {
  it.each([{ enabled: true, dailyLimit: 0 }, { enabled: true, dailyLimit: 201 }, { enabled: true, dailyLimit: 2.5 }, { enabled: "x", dailyLimit: 10 }, null])(
    "refuses %j before it reaches the database",
    async (input) => {
      const result = await saveAiReaderSettings(input);
      expect(result.ok).toBe(false);
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("saves through set_ai_feature for the certificate reader and refreshes the pages that use it", async () => {
    expect(await saveAiReaderSettings({ enabled: true, dailyLimit: "20" })).toEqual({ ok: true, data: null });
    expect(rpc).toHaveBeenCalledWith("set_ai_feature", { p_feature: "certificate-reader", p_enabled: true, p_daily_limit: 20 });
    expect(revalidatePath.mock.calls.map(([path]) => path).sort()).toEqual(["/me", "/records", "/settings"]);
  });

  it("answers a permission error with a plain message", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Only an admin can change this" } });
    expect(await saveAiReaderSettings({ enabled: true, dailyLimit: 10 })).toEqual({ ok: false, error: "You do not have permission to do this." });
  });

  it("never shows a raw database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "relation public.ai_feature_flags is broken" } });
    const result = await saveAiReaderSettings({ enabled: true, dailyLimit: 10 });
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
