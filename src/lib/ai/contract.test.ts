import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractRequestSchema, extractResponseSchema } from "@/lib/ai/contract";

const load = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const request = load("exam.request") as Record<string, unknown>;
const response = load("exam.response") as { result: Record<string, unknown> } & Record<string, unknown>;

describe("AI contract fixtures", () => {
  it.each(["exam.request", "completion.request"])("%s parses as a request", (name) => {
    expect(extractRequestSchema.safeParse(load(name)).success).toBe(true);
  });
  it.each(["exam.response", "completion.response"])("%s parses as a response", (name) => {
    expect(extractResponseSchema.safeParse(load(name)).success).toBe(true);
  });
});

describe("extractRequestSchema", () => {
  const page = { mime: "image/png", bytesBase64: "AAAA" };
  const entry = (n: number) => ({ id: `38e00000-0000-0000-0000-${String(n).padStart(12, "0")}`, kind: "exam", name: `C${n}`, provider: "P" });

  it("refuses 4 pages", () => {
    expect(extractRequestSchema.safeParse({ ...request, pages: [page, page, page, page] }).success).toBe(false);
  });
  it("refuses no pages", () => {
    expect(extractRequestSchema.safeParse({ ...request, pages: [] }).success).toBe(false);
  });
  it("accepts 300 catalogue entries and refuses 301", () => {
    expect(extractRequestSchema.safeParse({ ...request, catalogue: Array.from({ length: 300 }, (_, i) => entry(i + 1)) }).success).toBe(true);
    expect(extractRequestSchema.safeParse({ ...request, catalogue: Array.from({ length: 301 }, (_, i) => entry(i + 1)) }).success).toBe(false);
  });
  it("refuses an empty requestedBy", () => {
    expect(extractRequestSchema.safeParse({ ...request, requestedBy: "" }).success).toBe(false);
  });
  it("refuses a PDF page: pages are images only", () => {
    expect(extractRequestSchema.safeParse({ ...request, pages: [{ mime: "application/pdf", bytesBase64: "AAAA" }] }).success).toBe(false);
  });
});

describe("extractResponseSchema", () => {
  it("drops unknown keys such as holderName", () => {
    const parsed = extractResponseSchema.parse({ ...response, result: { ...response.result, holderName: "A Person" } });
    expect(JSON.stringify(parsed)).not.toContain("holderName");
    expect(JSON.stringify(parsed)).not.toContain("A Person");
  });
  it("refuses a partial date", () => {
    expect(extractResponseSchema.safeParse({ ...response, result: { ...response.result, issuedDate: "June 2025" } }).success).toBe(false);
  });
  it("refuses a dd/mm/yyyy date: the contract is ISO only", () => {
    expect(extractResponseSchema.safeParse({ ...response, result: { ...response.result, issuedDate: "14/03/2026" } }).success).toBe(false);
  });
  it("refuses an impossible ISO date", () => {
    expect(extractResponseSchema.safeParse({ ...response, result: { ...response.result, issuedDate: "2026-02-30" } }).success).toBe(false);
  });
  it("accepts nulls for unreadable fields", () => {
    const nulls = { kind: "exam", certificateId: null, certificateName: null, provider: null, issuedDate: null, validUntil: null, verifyUrl: null };
    expect(extractResponseSchema.safeParse({ ...response, result: nulls }).success).toBe(true);
  });
  it("refuses a non-http verify link", () => {
    expect(extractResponseSchema.safeParse({ ...response, result: { ...response.result, verifyUrl: "javascript:alert(1)" } }).success).toBe(false);
  });
  it("refuses confidence outside 0..1", () => {
    expect(extractResponseSchema.safeParse({ ...response, confidence: { issuedDate: 1.5 } }).success).toBe(false);
  });
  it("accepts a known error code and refuses an unknown one", () => {
    expect(extractResponseSchema.safeParse({ ok: false, error: "timeout" }).success).toBe(true);
    expect(extractResponseSchema.safeParse({ ok: false, error: "nope" }).success).toBe(false);
  });
});
