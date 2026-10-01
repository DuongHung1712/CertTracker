import { describe, expect, it } from "vitest";
import { batchIdSchema, importSummarySchema, messagesSchema, normalizedRefsSchema, rawSchema } from "@/features/import/schema";

describe("import schemas", () => {
  it("accepts only a uuid batch id", () => {
    expect(batchIdSchema.safeParse({ batchId: "5eed0000-0000-0000-0000-00000000b001" }).success).toBe(true);
    expect(batchIdSchema.safeParse({ batchId: "../etc" }).success).toBe(false);
  });

  it("validates the commit summary", () => {
    expect(importSummarySchema.safeParse({ created: 1, updated: 2, skipped: 0, newMembers: 0, newCourses: 1 }).success).toBe(true);
    expect(importSummarySchema.safeParse({ created: 1 }).success).toBe(false);
    expect(importSummarySchema.safeParse({ created: 1.5, updated: 0, skipped: 0, newMembers: 0, newCourses: 0 }).success).toBe(false);
  });

  it("degrades malformed messages to an empty list", () => {
    expect(messagesSchema.parse(["a", "b"])).toEqual(["a", "b"]);
    expect(messagesSchema.parse([1, "a"])).toEqual([]);
    expect(messagesSchema.parse({ not: "an array" })).toEqual([]);
  });

  it("degrades malformed raw to an empty shape", () => {
    const empty = { cells: {}, email: null, course: null };
    const good = { cells: { A: 1, B: "x", C: null }, email: "a@b.c", course: null };
    expect(rawSchema.parse(good)).toEqual(good);
    expect(rawSchema.parse(null)).toEqual(empty);
    expect(rawSchema.parse({ cells: { A: { nested: 1 } }, email: null, course: null })).toEqual(empty);
  });

  it("keeps only member/course references of normalized and nulls anything else", () => {
    const parsed = normalizedRefsSchema.parse({
      member: { email: "a@b.c", fullName: "A", teamId: null },
      course: { name: "C", provider: { name: "P" }, certType: null, validityMonths: 12 },
      record: { status: "done" },
    });
    expect(parsed).toEqual({
      member: { email: "a@b.c", fullName: "A" },
      course: { name: "C", provider: { name: "P" }, certType: null },
    });
    const withCatalogIds = normalizedRefsSchema.parse({
      member: { id: "m" },
      course: { name: "C", provider: { id: "p" }, certType: { name: "T" }, validityMonths: null },
    });
    expect(withCatalogIds).toEqual({ member: { id: "m" }, course: { name: "C", provider: { id: "p" }, certType: { name: "T" } } });
    expect(normalizedRefsSchema.parse({ member: { id: "m" }, course: { id: "c" } })).toEqual({ member: { id: "m" }, course: { id: "c" } });
    expect(normalizedRefsSchema.parse(null)).toBeNull();
    expect(normalizedRefsSchema.parse({ member: 1 })).toBeNull();
  });
});
