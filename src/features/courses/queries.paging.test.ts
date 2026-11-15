import { describe, expect, it, vi } from "vitest";
import { listCertificates } from "@/features/certificates/queries";
import { listCourses } from "@/features/courses/queries";

// A table of 1,200 rows behind a PostgREST-like `.range()` that never returns more than 1,000 at once.
const TOTAL = 1200;
const all = Array.from({ length: TOTAL }, (_, i) => ({ id: `id-${i}`, name: `n${i}`, kind: "exam" }));

function table() {
  const self = {
    select: () => self,
    order: () => self,
    range: (from: number, to: number) => Promise.resolve({ data: all.slice(from, Math.min(to, from + 999) + 1), error: null }),
  };
  return self;
}

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: table }) }));

describe("catalogue queries page past the 1,000-row cap", () => {
  it("listCertificates returns every row", async () => {
    expect(await listCertificates()).toHaveLength(TOTAL);
  });

  it("listCourses returns every row", async () => {
    expect(await listCourses()).toHaveLength(TOTAL);
  });
});
