import type { ExtractRequest, ExtractResponse } from "@/lib/ai/contract";
import { DeepSeekGateway } from "@/lib/ai/deepseek-gateway";
import { FakeGateway } from "@/lib/ai/fake-gateway";

export interface AiGateway {
  readonly transport: "fake" | "deepseek";
  /** Never throws: every failure is `{ ok: false, error }`, so a provider fault cannot break the main flow. */
  extractCertificate(request: ExtractRequest): Promise<ExtractResponse>;
}

export class AiConfigError extends Error {}

/** Same shape as `createEmailSender`: `AI_TRANSPORT` picks the implementation; `fake` is dev/test only. */
export function createAiGateway(env: Record<string, string | undefined> = process.env): AiGateway {
  const transport = env.AI_TRANSPORT || undefined;
  const production = env.NODE_ENV === "production";
  if (transport !== undefined && transport !== "fake" && transport !== "deepseek" && transport !== "http") {
    throw new AiConfigError('AI_TRANSPORT must be "fake" or "deepseek".');
  }
  if (transport === "http") throw new AiConfigError("AI_TRANSPORT=http is not built yet.");
  if (transport === "fake" && production) throw new AiConfigError("AI_TRANSPORT=fake is not allowed in production.");
  if (transport === undefined && production) throw new AiConfigError("AI_TRANSPORT is not set.");

  if (transport === "fake" || transport === undefined) return new FakeGateway();
  if (!env.DEEPSEEK_API_KEY) throw new AiConfigError("DEEPSEEK_API_KEY is not set.");
  return new DeepSeekGateway({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: env.DEEPSEEK_MODEL || "deepseek-flash",
    timeoutMs: 45_000,
  });
}
