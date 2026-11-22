import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractRequestSchema, type ExtractRequest } from "@/lib/ai/contract";
import { DeepSeekGateway } from "@/lib/ai/deepseek-gateway";

const request: ExtractRequest = extractRequestSchema.parse(JSON.parse(readFileSync(new URL("./fixtures/exam.request.json", import.meta.url), "utf8")));
const KEY = "sk-test-secret-key";

const modelOutput = {
  kind: "exam",
  certificateId: "38e00000-0000-0000-0000-000000000001",
  certificateName: "AWS Certified Solutions Architect - Associate",
  provider: "Amazon Web Services",
  issuedDate: "2026-03-14",
  validUntil: null,
  verifyUrl: null,
  confidence: { certificateId: 0.95, issuedDate: 0.9 },
};

const apiBody = (content: string | null, usage: unknown = { prompt_tokens: 1450, completion_tokens: 120 }) =>
  JSON.stringify({ choices: [{ message: { content } }], usage });

const reply = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));
const gateway = (fetchImpl: typeof fetch, timeoutMs = 45_000) =>
  new DeepSeekGateway({ apiKey: KEY, baseUrl: "https://api.deepseek.com", model: "deepseek-flash", timeoutMs, fetch: fetchImpl });

afterEach(() => vi.useRealTimers());

describe("DeepSeekGateway", () => {
  it("turns a good JSON answer into a success with usage from the API", async () => {
    const response = await gateway(reply(apiBody(JSON.stringify(modelOutput)))).extractCertificate(request);
    expect(response).toMatchObject({
      ok: true,
      result: { kind: "exam", certificateId: "38e00000-0000-0000-0000-000000000001", issuedDate: "2026-03-14" },
      confidence: { issuedDate: 0.9 },
      usage: { inputTokens: 1450, outputTokens: 120 },
    });
  });

  it("rejects fenced JSON as invalid_output", async () => {
    const fenced = "```json\n" + JSON.stringify(modelOutput) + "\n```";
    expect(await gateway(reply(apiBody(fenced))).extractCertificate(request)).toEqual({ ok: false, error: "invalid_output" });
  });

  it("rejects blank content as invalid_output", async () => {
    expect(await gateway(reply(apiBody("  "))).extractCertificate(request)).toEqual({ ok: false, error: "invalid_output" });
    expect(await gateway(reply(apiBody(null))).extractCertificate(request)).toEqual({ ok: false, error: "invalid_output" });
  });

  it("turns a partial date into null instead of failing the read (spec: month and year only is null)", async () => {
    const partial = { ...modelOutput, issuedDate: "June 2025" };
    const response = await gateway(reply(apiBody(JSON.stringify(partial)))).extractCertificate(request);
    expect(response).toMatchObject({ ok: true, result: { issuedDate: null } });
    expect(response.ok && "issuedDate" in response.confidence).toBe(false);
  });

  it("maps an unreadable answer to unreadable", async () => {
    expect(await gateway(reply(apiBody(JSON.stringify({ unreadable: true })))).extractCertificate(request)).toEqual({ ok: false, error: "unreadable" });
  });

  it("drops holderName from the result", async () => {
    const withName = { ...modelOutput, holderName: "A Person" };
    const response = await gateway(reply(apiBody(JSON.stringify(withName)))).extractCertificate(request);
    expect(response.ok).toBe(true);
    expect(JSON.stringify(response)).not.toContain("holderName");
    expect(JSON.stringify(response)).not.toContain("A Person");
  });

  it("reports zero usage when the API gives no usage numbers", async () => {
    const response = await gateway(reply(apiBody(JSON.stringify(modelOutput), null))).extractCertificate(request);
    expect(response).toMatchObject({ ok: true, usage: { inputTokens: 0, outputTokens: 0 } });
  });

  it("nulls a field that is malformed and keeps the good ones", async () => {
    const messy = {
      ...modelOutput,
      verifyUrl: "credly.com/badges/x",
      validUntil: "2029",
      certificateName: undefined,
      confidence: { certificateId: "high", issuedDate: 0.9, verifyUrl: 0.8, validUntil: 95 },
    };
    const response = await gateway(reply(apiBody(JSON.stringify(messy)))).extractCertificate(request);
    expect(response).toMatchObject({
      ok: true,
      result: { kind: "exam", certificateId: "38e00000-0000-0000-0000-000000000001", issuedDate: "2026-03-14", verifyUrl: null, validUntil: null, certificateName: null },
    });
    // Confidence stays only for fields that kept a value and gave a number from 0 to 1.
    expect(response.ok && response.confidence).toEqual({ issuedDate: 0.9 });
  });

  it("still rejects an answer with no usable kind", async () => {
    const noKind = { ...modelOutput, kind: "diploma" };
    expect(await gateway(reply(apiBody(JSON.stringify(noKind)))).extractCertificate(request)).toEqual({ ok: false, error: "invalid_output" });
  });

  it("returns timeout when the provider never answers", async () => {
    vi.useFakeTimers();
    const hang = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const pending = gateway(hang as unknown as typeof fetch, 45_000).extractCertificate(request);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await pending).toEqual({ ok: false, error: "timeout" });
  });

  it("cancels the provider call when the caller aborts (the member replaced the file)", async () => {
    const hang = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    }));
    const caller = new AbortController();
    const pending = gateway(hang as unknown as typeof fetch).extractCertificate(request, { signal: caller.signal });
    caller.abort();
    expect(await pending).toEqual({ ok: false, error: "provider_error" });
    const [, init] = hang.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal?.aborted).toBe(true);
  });

  it("hands an already-aborted caller's signal to fetch, so the call ends at once", async () => {
    const hang = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(new Error("aborted"));
    }));
    const caller = new AbortController();
    caller.abort();
    expect(await gateway(hang as unknown as typeof fetch).extractCertificate(request, { signal: caller.signal })).toEqual({ ok: false, error: "provider_error" });
  });

  it("maps HTTP 500 and a network error to provider_error", async () => {
    expect(await gateway(reply("oops", 500)).extractCertificate(request)).toEqual({ ok: false, error: "provider_error" });
    const down = vi.fn(async () => { throw new Error("ECONNRESET"); });
    expect(await gateway(down as unknown as typeof fetch).extractCertificate(request)).toEqual({ ok: false, error: "provider_error" });
  });

  it("sends the key, model, images and catalogue, but not the requester", async () => {
    const fetchSpy = reply(apiBody(JSON.stringify(modelOutput)));
    await gateway(fetchSpy).extractCertificate(request);
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    const body = String(init.body);
    expect(url).toBe("https://api.deepseek.com/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(body)).toMatchObject({
      model: "deepseek-flash",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    expect(body).toContain("data:image/png;base64,");
    expect(body).toContain("38e00000-0000-0000-0000-000000000001");
    expect(body.toLowerCase()).toContain("json");
    expect(body).not.toContain("requestedBy");
    expect(body).not.toContain("M001");
  });

  it("never puts the API key in what it returns, even when the failure message contains it", async () => {
    const leaky = vi.fn(async () => { throw new Error(`bad key ${KEY}`); });
    const response = await gateway(leaky as unknown as typeof fetch).extractCertificate(request);
    expect(JSON.stringify(response)).not.toContain(KEY);
  });
});
