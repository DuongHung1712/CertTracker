import { extractResponseSchema, RESULT_FIELDS, type AiErrorCode, type ExtractRequest, type ExtractResponse } from "@/lib/ai/contract";
import type { AiGateway } from "@/lib/ai/gateway";

export type DeepSeekOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  fetch?: typeof fetch;
};

const SYSTEM_PROMPT = [
  "You read one certificate (an image, possibly several pages of one document) and answer with a single json object, nothing else.",
  'First decide the kind: "exam" if it is earned by passing an exam and may expire, "completion" if it only confirms finishing a course.',
  'exam json: {"kind":"exam","certificateId":null,"certificateName":null,"provider":null,"issuedDate":null,"validUntil":null,"verifyUrl":null,"confidence":{}}',
  'completion json: {"kind":"completion","certificateId":null,"courseName":null,"provider":null,"completedDate":null,"confidence":{}}',
  "certificateId: pick the id of the catalogue line that is this certificate, copied exactly, or null if none matches. Never invent an id.",
  "Dates are YYYY-MM-DD only. If the document shows only a month and year, or no date, use null.",
  "Use null for anything you cannot read. confidence maps each field name you filled to a number from 0 to 1.",
  "Never output the holder's name, email or any personal data.",
  'If the image is not a certificate or cannot be read, answer {"unreadable":true}.',
].join("\n");

const failure = (error: AiErrorCode): ExtractResponse => ({ ok: false, error });
const asCount = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0);

function catalogueText(request: ExtractRequest): string {
  if (request.catalogue.length === 0) return "Catalogue: (empty)";
  return ["Catalogue (id | kind | provider | name):", ...request.catalogue.map((e) => `${e.id} | ${e.kind} | ${e.provider} | ${e.name}`)].join("\n");
}

/** OpenAI-compatible chat completion with an image. Never throws and never echoes provider text, so a key or file detail cannot leak. */
export class DeepSeekGateway implements AiGateway {
  readonly transport = "deepseek" as const;

  constructor(private readonly options: DeepSeekOptions) {}

  async extractCertificate(request: ExtractRequest, options: { signal?: AbortSignal } = {}): Promise<ExtractResponse> {
    const { apiKey, baseUrl, model, timeoutMs } = this.options;
    const send = this.options.fetch ?? fetch;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    // The caller gave up (the member replaced the file): stop the provider call too.
    const cancel = () => controller.abort();
    if (options.signal?.aborted) cancel();
    options.signal?.addEventListener("abort", cancel, { once: true });

    try {
      const response = await send(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 800,
          response_format: { type: "json_object" },
          thinking: { type: "disabled" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: catalogueText(request) },
                ...request.pages.map((page) => ({ type: "image_url", image_url: { url: `data:${page.mime};base64,${page.bytesBase64}` } })),
              ],
            },
          ],
        }),
        signal: controller.signal,
      });
      if (!response.ok) return failure("provider_error");
      return this.parse(await response.json());
    } catch {
      return failure(timedOut ? "timeout" : "provider_error");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
    }
  }

  private parse(data: unknown): ExtractResponse {
    const body = data as { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") return failure("invalid_output");

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return failure("invalid_output");
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return failure("invalid_output");
    if ((parsed as { unreadable?: unknown }).unreadable === true) return failure("unreadable");

    const { confidence: rawConfidence, ...result } = parsed as Record<string, unknown>;
    const fields = result.kind === "exam" ? RESULT_FIELDS.exam : result.kind === "completion" ? RESULT_FIELDS.completion : null;
    if (!fields) return failure("invalid_output");

    // One malformed field (a link with no scheme, a partial date, a shortened id) must not cost the member the whole read:
    // it becomes null, and only a structural fault is invalid_output. The strict schema below is still the final check.
    const given = typeof rawConfidence === "object" && rawConfidence !== null ? (rawConfidence as Record<string, unknown>) : {};
    const confidence: Record<string, number> = {};
    for (const [key, schema] of Object.entries(fields)) {
      if (key === "kind") continue;
      if (!schema.safeParse(result[key]).success) {
        result[key] = null;
        continue;
      }
      const level = given[key];
      if (typeof level === "number" && level >= 0 && level <= 1) confidence[key] = level;
    }
    const checked = extractResponseSchema.safeParse({
      ok: true,
      result,
      confidence,
      // Field names are the OpenAI-compatible ones; absent numbers count as 0 (verify against a real response, ledger Task 4).
      usage: { inputTokens: asCount(body?.usage?.prompt_tokens), outputTokens: asCount(body?.usage?.completion_tokens) },
    });
    return checked.success ? checked.data : failure("invalid_output");
  }
}
