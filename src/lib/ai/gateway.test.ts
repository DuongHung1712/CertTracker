import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractRequestSchema, extractResponseSchema, type ExtractRequest } from "@/lib/ai/contract";
import { AiConfigError, createAiGateway } from "@/lib/ai/gateway";
import { FakeGateway } from "@/lib/ai/fake-gateway";

const base = extractRequestSchema.parse(JSON.parse(readFileSync(new URL("./fixtures/exam.request.json", import.meta.url), "utf8")));
const entry = (kind: "exam" | "completion"): ExtractRequest["catalogue"][number] => ({
  id: "38e00000-0000-0000-0000-0000000000aa",
  kind,
  name: "Sample",
  provider: "P",
});

describe("createAiGateway", () => {
  it("defaults to the fake gateway outside production", () => {
    expect(createAiGateway({}).transport).toBe("fake");
  });
  it("refuses an unset transport in production", () => {
    expect(() => createAiGateway({ NODE_ENV: "production" })).toThrow(AiConfigError);
  });
  it("refuses the fake gateway in production", () => {
    expect(() => createAiGateway({ NODE_ENV: "production", AI_TRANSPORT: "fake" })).toThrow(AiConfigError);
  });
  it("requires a key for deepseek", () => {
    expect(() => createAiGateway({ AI_TRANSPORT: "deepseek" })).toThrow(/DEEPSEEK_API_KEY/);
  });
  it("says http is not built yet", () => {
    expect(() => createAiGateway({ AI_TRANSPORT: "http" })).toThrow(/not built yet/);
  });
  it("refuses an unknown transport", () => {
    expect(() => createAiGateway({ AI_TRANSPORT: "openai" })).toThrow(AiConfigError);
  });
});

describe("FakeGateway", () => {
  const gateway = new FakeGateway();

  it("answers an exam-first catalogue with an exam that carries that id", async () => {
    const response = await gateway.extractCertificate({ ...base, catalogue: [entry("exam")] });
    expect(extractResponseSchema.safeParse(response).success).toBe(true);
    expect(response.ok && response.result.kind).toBe("exam");
    expect(response.ok && response.result.certificateId).toBe("38e00000-0000-0000-0000-0000000000aa");
  });
  it("answers a completion-first catalogue with a completion that carries that id", async () => {
    const response = await gateway.extractCertificate({ ...base, catalogue: [entry("completion")] });
    expect(extractResponseSchema.safeParse(response).success).toBe(true);
    expect(response.ok && response.result.kind).toBe("completion");
    expect(response.ok && response.result.certificateId).toBe("38e00000-0000-0000-0000-0000000000aa");
  });
  it("answers an empty catalogue with null ids", async () => {
    const response = await gateway.extractCertificate({ ...base, catalogue: [] });
    expect(extractResponseSchema.safeParse(response).success).toBe(true);
    expect(response.ok && response.result.certificateId).toBeNull();
  });
});
