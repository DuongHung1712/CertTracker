import { beforeEach, describe, expect, it, vi } from "vitest";
import { setMemberAccess } from "@/features/members/actions";

const USER_ID = "5eed0000-0000-0000-0000-00000000f00b";
const update = vi.fn();
let currentUserId = "someone-else";
let updatedRows: { user_id: string }[] = [{ user_id: USER_ID }];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/auth/queries", () => ({ getCurrentUser: async () => ({ id: currentUserId }) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: (values: unknown) => {
        update(values);
        return { eq: () => ({ select: async () => ({ data: updatedRows, error: null }) }) };
      },
    }),
  }),
}));

beforeEach(() => {
  update.mockClear();
  currentUserId = "someone-else";
  updatedRows = [{ user_id: USER_ID }];
});

describe("setMemberAccess", () => {
  it("changes another user's role", async () => {
    expect(await setMemberAccess({ userId: USER_ID, role: "manager" })).toEqual({ ok: true, data: null });
    expect(update).toHaveBeenCalledWith({ role: "manager" });
  });

  it("refuses to change your own access, so the acting admin stays an admin", async () => {
    currentUserId = USER_ID;
    const result = await setMemberAccess({ userId: USER_ID, role: "member" });
    expect(result).toEqual({ ok: false, error: "You cannot change your own access. Ask another admin." });
    expect(update).not.toHaveBeenCalled();
  });

  it("reports an error when RLS filters the update to zero rows, as it does for a non-admin", async () => {
    updatedRows = [];
    expect(await setMemberAccess({ userId: USER_ID, role: "manager" })).toEqual({
      ok: false,
      error: "You do not have permission to do this, or the item no longer exists.",
    });
  });
});
