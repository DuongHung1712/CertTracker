import { beforeEach, describe, expect, it, vi } from "vitest";
import { setMemberAccess } from "@/features/members/actions";

const USER_ID = "5eed0000-0000-0000-0000-00000000f00b";
const update = vi.fn();
let currentUserId = "someone-else";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: async () => ({ id: currentUserId }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: () => ({ select: async () => ({ data: [{ user_id: USER_ID }], error: null }) }) };
      },
    }),
  }),
}));

beforeEach(() => {
  update.mockClear();
  currentUserId = "someone-else";
});

describe("setMemberAccess", () => {
  it("changes another user's role", async () => {
    expect(await setMemberAccess({ userId: USER_ID, role: "manager" })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledWith({ role: "manager" });
  });

  it("refuses to change your own access, so the acting admin stays an admin", async () => {
    currentUserId = USER_ID;
    const result = await setMemberAccess({ userId: USER_ID, role: "member" });
    expect(result).toEqual({ ok: false, error: "You can't change your own access. Ask another admin." });
    expect(update).not.toHaveBeenCalled();
  });
});
