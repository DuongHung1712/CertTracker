import { describe, expect, it, vi } from "vitest";
import type { ExtractResponse } from "@/lib/ai/contract";
import type { AiGateway } from "@/lib/ai/gateway";
import { ratesFromEnv, estimateCostMicroUsd } from "@/lib/ai/limits";
import type { UsageStore } from "@/lib/ai/usage-store";
import { EVIDENCE_EMPTY_MESSAGE, EVIDENCE_TOO_LARGE_MESSAGE, EVIDENCE_WRONG_TYPE_MESSAGE, MAX_EVIDENCE_BYTES } from "@/lib/storage/evidence";
import { findProviderId, readCertificate, type ReadDeps } from "@/features/records/ai-read";

const EXAM_ID = "38e00000-0000-0000-0000-000000000001";
const COMPLETION_ID = "38e00000-0000-0000-0000-000000000002";
const OUTSIDE_ID = "38e00000-0000-0000-0000-0000000000ff";
const catalogue = [
  { id: EXAM_ID, kind: "exam" as const, name: "AWS SAA", provider: "AWS" },
  { id: COMPLETION_ID, kind: "completion" as const, name: "Docker Fundamentals", provider: "Udemy" },
];

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4];
const png = () => new File([new Uint8Array(PNG)], "cert.png", { type: "image/png" });

const examAnswer = (over: Record<string, unknown> = {}, confidence: Record<string, number> = { certificateId: 0.9, issuedDate: 0.9, validUntil: 0.8, verifyUrl: 0.8 }): ExtractResponse =>
  ({
    ok: true,
    result: { kind: "exam", certificateId: EXAM_ID, certificateName: "AWS SAA", provider: "AWS", issuedDate: "2026-03-14", validUntil: "2029-03-14", verifyUrl: "https://example.com/v", ...over },
    confidence,
    usage: { inputTokens: 1450, outputTokens: 120 },
  }) as ExtractResponse;

function setup(answer: ExtractResponse | (() => Promise<ExtractResponse>), claim: Awaited<ReturnType<UsageStore["claim"]>> = { ok: true, usageId: "u-1" }) {
  const finish = vi.fn(async () => undefined);
  const claimFn = vi.fn(async () => claim);
  const extractCertificate = vi.fn(typeof answer === "function" ? answer : async () => answer);
  const deps: ReadDeps = {
    gateway: { transport: "fake", extractCertificate } as AiGateway,
    usage: { isEnabled: async () => true, claim: claimFn, finish },
    rates: ratesFromEnv({}),
    threshold: 0.6,
    catalogue: async () => catalogue,
    pages: vi.fn(async () => ({ ok: true as const, data: [{ mime: "image/png" as const, bytesBase64: "AAAA" }] })),
    today: "2026-11-22",
  };
  return { deps, finish, claimFn, extractCertificate };
}

describe("readCertificate: file checks run before any claim", () => {
  it("refuses an empty file", async () => {
    const { deps, claimFn } = setup(examAnswer());
    expect(await readCertificate(deps, { memberCode: "M001", file: new File([], "a.png") })).toEqual({ ok: false, error: EVIDENCE_EMPTY_MESSAGE });
    expect(claimFn).not.toHaveBeenCalled();
  });
  it("refuses a file over 4 MB", async () => {
    const { deps, claimFn } = setup(examAnswer());
    const big = new File([new Uint8Array(MAX_EVIDENCE_BYTES + 1)], "a.png", { type: "image/png" });
    expect(await readCertificate(deps, { memberCode: "M001", file: big })).toEqual({ ok: false, error: EVIDENCE_TOO_LARGE_MESSAGE });
    expect(claimFn).not.toHaveBeenCalled();
  });
  it("refuses bytes that are not an image even when File.type says image/png", async () => {
    const { deps, claimFn, extractCertificate } = setup(examAnswer());
    const fake = new File([new Uint8Array([1, 2, 3, 4, 5])], "a.png", { type: "image/png" });
    expect(await readCertificate(deps, { memberCode: "M001", file: fake })).toEqual({ ok: false, error: EVIDENCE_WRONG_TYPE_MESSAGE });
    expect(claimFn).not.toHaveBeenCalled();
    expect(extractCertificate).not.toHaveBeenCalled();
  });
});

describe("readCertificate: cancelling", () => {
  it("uses no call of the daily limit when the member had already replaced the file", async () => {
    const { deps, claimFn, extractCertificate } = setup(examAnswer());
    const controller = new AbortController();
    controller.abort();
    const result = await readCertificate(deps, { memberCode: "M001", file: png(), signal: controller.signal });
    expect(result.ok).toBe(false);
    expect(claimFn).not.toHaveBeenCalled();
    expect(extractCertificate).not.toHaveBeenCalled();
  });

  it("hands the caller's signal to the gateway so a replaced file stops the provider call", async () => {
    const { deps, extractCertificate } = setup(examAnswer());
    const controller = new AbortController();
    await readCertificate(deps, { memberCode: "M001", file: png(), signal: controller.signal });
    expect((extractCertificate.mock.calls[0] as unknown[] | undefined)?.[1]).toEqual({ signal: controller.signal });
  });
});

describe("readCertificate: switch and limit", () => {
  it("says the feature is unavailable when the flag is off and logs nothing", async () => {
    const { deps, finish, extractCertificate } = setup(examAnswer(), { ok: false, reason: "disabled" });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/not available/i);
    expect(finish).not.toHaveBeenCalled();
    expect(extractCertificate).not.toHaveBeenCalled();
  });
  it("says the daily limit is used up", async () => {
    const { deps, finish } = setup(examAnswer(), { ok: false, reason: "daily_limit" });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(!result.ok && result.error).toMatch(/today/i);
    expect(finish).not.toHaveBeenCalled();
  });
});

describe("readCertificate: turning the answer into a suggestion", () => {
  it("keeps a matched id, the date, the link and lists the filled fields", async () => {
    const { deps } = setup(examAnswer());
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result).toEqual({
      ok: true,
      data: { kind: "exam", certificateId: EXAM_ID, issuedDate: "2026-03-14", certificateUrl: "https://example.com/v", validUntil: "2029-03-14", readName: "AWS SAA", readProvider: "AWS", aiFields: ["certificateId", "issuedDate", "certificateUrl"] },
    });
  });
  it("sets an id that was not in the catalogue to null", async () => {
    const { deps } = setup(examAnswer({ certificateId: OUTSIDE_ID }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.certificateId).toBeNull();
    expect(result.ok && result.data.aiFields).not.toContain("certificateId");
  });
  it("lets the catalogue entry's kind win over the model's", async () => {
    const { deps } = setup(examAnswer({ certificateId: COMPLETION_ID }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.kind).toBe("completion");
    expect(result.ok && result.data.certificateId).toBe(COMPLETION_ID);
  });
  it("leaves a field empty when its confidence is under the threshold", async () => {
    const { deps } = setup(examAnswer({}, { certificateId: 0.9, issuedDate: 0.4, verifyUrl: 0.8 }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.issuedDate).toBeNull();
    expect(result.ok && result.data.aiFields).not.toContain("issuedDate");
  });
  it("treats a field with no confidence as unsure", async () => {
    const { deps } = setup(examAnswer({}, { certificateId: 0.9 }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.issuedDate).toBeNull();
    expect(result.ok && result.data.certificateUrl).toBeNull();
  });
  it("drops a date later than today", async () => {
    const { deps } = setup(examAnswer({ issuedDate: "2026-11-23" }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.issuedDate).toBeNull();
  });
  it("accepts today's date", async () => {
    const { deps } = setup(examAnswer({ issuedDate: "2026-11-22" }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data.issuedDate).toBe("2026-11-22");
  });
  it("reads a completion's date from completedDate", async () => {
    const { deps } = setup({
      ok: true,
      result: { kind: "completion", certificateId: COMPLETION_ID, courseName: "Docker", provider: "Udemy", completedDate: "2026-02-01" },
      confidence: { certificateId: 0.9, completedDate: 0.9 },
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data).toMatchObject({ kind: "completion", issuedDate: "2026-02-01", certificateUrl: null, validUntil: null });
  });
  it("returns the name and provider the model read even when nothing matched the catalogue", async () => {
    const { deps } = setup(examAnswer({ certificateId: OUTSIDE_ID }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data).toMatchObject({ certificateId: null, readName: "AWS SAA", readProvider: "AWS" });
  });
  it("reads a completion's course name as the name", async () => {
    const { deps } = setup({
      ok: true,
      result: { kind: "completion", certificateId: null, courseName: "Introduction to subagents", provider: "Anthropic", completedDate: null },
      confidence: {},
      usage: { inputTokens: 1, outputTokens: 1 },
    });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data).toMatchObject({ kind: "completion", certificateId: null, issuedDate: null, readName: "Introduction to subagents", readProvider: "Anthropic" });
  });
  it("turns a blank name or provider into null", async () => {
    const { deps } = setup(examAnswer({ certificateName: "   ", provider: "" }));
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok && result.data).toMatchObject({ readName: null, readProvider: null });
  });
  it("never returns the holder name, even if the gateway sent one", async () => {
    const withName = examAnswer({ holderName: "A Person" });
    const { deps, finish } = setup(withName);
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(JSON.stringify(result)).not.toContain("A Person");
    expect(JSON.stringify(finish.mock.calls)).not.toContain("A Person");
  });
});

describe("readCertificate: logging", () => {
  it("finishes with the estimated cost and outcome ok", async () => {
    const { deps, finish } = setup(examAnswer());
    await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(finish).toHaveBeenCalledWith("u-1", {
      inputTokens: 1450,
      outputTokens: 120,
      costMicroUsd: estimateCostMicroUsd({ inputTokens: 1450, outputTokens: 120 }, ratesFromEnv({})),
      outcome: "ok",
    });
  });
  it("finishes a timeout with outcome timeout and a message", async () => {
    const { deps, finish } = setup({ ok: false, error: "timeout" });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(!result.ok && result.error.length).toBeGreaterThan(0);
    expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: "timeout" }));
  });
  it("finishes unreadable, invalid_output and provider_error answers with their outcome", async () => {
    for (const error of ["unreadable", "invalid_output", "provider_error"] as const) {
      const { deps, finish } = setup({ ok: false, error });
      await readCertificate(deps, { memberCode: "M001", file: png() });
      expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: error }));
    }
  });
  it("finishes as unreadable when the pages step fails", async () => {
    const { deps, finish, extractCertificate } = setup(examAnswer());
    deps.pages = async () => ({ ok: false, error: "That PDF could not be read." });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result).toEqual({ ok: false, error: "That PDF could not be read." });
    expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: "unreadable" }));
    expect(extractCertificate).not.toHaveBeenCalled();
  });
  it("does not throw when the gateway throws, and finishes as provider_error", async () => {
    const { deps, finish } = setup(async () => {
      throw new Error("boom");
    });
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok).toBe(false);
    expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: "provider_error" }));
  });
  it("rejects a gateway answer that breaks the contract as invalid_output", async () => {
    const { deps, finish } = setup({ ok: true, result: { kind: "exam" } } as unknown as ExtractResponse);
    const result = await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(result.ok).toBe(false);
    expect(finish).toHaveBeenCalledWith("u-1", expect.objectContaining({ outcome: "invalid_output" }));
  });
  it("sends the member code and the catalogue to the gateway", async () => {
    const { deps, extractCertificate } = setup(examAnswer());
    await readCertificate(deps, { memberCode: "M001", file: png() });
    expect(extractCertificate).toHaveBeenCalledWith(expect.objectContaining({ feature: "certificate-reader", requestedBy: "M001", catalogue }), expect.anything());
  });
});

describe("findProviderId", () => {
  const providers = [
    { id: "p1", name: "Amazon Web Services" },
    { id: "p2", name: "Anthropic" },
  ];
  it("matches a name ignoring case and surrounding spaces", () => {
    expect(findProviderId("  anthropic ", providers)).toBe("p2");
  });
  it("is null for an unknown provider, a blank one or none", () => {
    expect(findProviderId("Udemy", providers)).toBeNull();
    expect(findProviderId("  ", providers)).toBeNull();
    expect(findProviderId(null, providers)).toBeNull();
  });
});
