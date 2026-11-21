import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/features/notifications/snapshot";
import type { Database } from "@/types/database";

const TABLES: Record<string, unknown[]> = {
  members: [{ id: "m1", code: "M001", full_name: "Jane", email: "j@x.vn", team_id: null, is_active: true }],
  teams: [],
  v_training_records: [],
  v_learning_items: [
    { id: "li-open", member_id: "m1", status: "in_progress", target_certificate_name: "HSK 3", course_name: null },
    { id: "li-course", member_id: "m1", status: "not_started", target_certificate_name: null, course_name: "Udemy SAA" },
  ],
};

function fakeClient() {
  const chain = (rows: unknown[]) => {
    const self = {
      select: () => self,
      order: () => self,
      neq: () => self,
      range: async () => ({ data: rows, error: null }),
    };
    return self;
  };
  return {
    from: (table: string) => chain(TABLES[table] ?? []),
    rpc: async () => ({ data: [], error: null }),
  } as unknown as SupabaseClient<Database>;
}

describe("loadSnapshot (decision #72)", () => {
  it("adds open learning items as journey rows the monthly numbers count as in progress / not started", async () => {
    const snapshot = await loadSnapshot(fakeClient());
    expect(snapshot.records.map((r) => [r.id, r.status, r.certificateName, r.approval])).toEqual([
      ["li-open", "in_progress", "HSK 3", null],
      ["li-course", "not_started", "Udemy SAA", null],
    ]);
  });
});
