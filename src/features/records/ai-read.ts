import type { CertificateKind } from "@/features/certificates/schema";
import { extractResponseSchema, MAX_CATALOGUE, type AiErrorCode, type ExtractResult } from "@/lib/ai/contract";
import type { AiGateway } from "@/lib/ai/gateway";
import { estimateCostMicroUsd, type Rates } from "@/lib/ai/limits";
import type { UsageStore } from "@/lib/ai/usage-store";
import { err, ok, type Result } from "@/lib/result";
import {
  EVIDENCE_EMPTY_MESSAGE,
  EVIDENCE_TOO_LARGE_MESSAGE,
  EVIDENCE_WRONG_TYPE_MESSAGE,
  MAX_EVIDENCE_BYTES,
  sniffEvidenceType,
  type EvidenceMime,
} from "@/lib/storage/evidence";

const FEATURE = "certificate-reader";

export type CatalogueEntry = { id: string; kind: CertificateKind; name: string; provider: string };
export type ImagePage = { mime: "image/jpeg" | "image/png" | "image/webp"; bytesBase64: string };

export type CertificateSuggestion = {
  kind: CertificateKind;
  certificateId: string | null;
  issuedDate: string | null;
  certificateUrl: string | null;
  /** For the member to compare with the catalogue's validity; not a form field. */
  validUntil: string | null;
  /** The name and provider the model read from the file (a hint for the member; shown when nothing matched, never saved as is). */
  readName: string | null;
  readProvider: string | null;
  /** The form fields the AI filled (so the form can mark them). */
  aiFields: ("certificateId" | "issuedDate" | "certificateUrl")[];
};

export type ReadDeps = {
  gateway: AiGateway;
  usage: UsageStore;
  rates: Rates;
  threshold: number;
  /** Approved catalogue entries, read with the user's JWT. */
  catalogue: () => Promise<CatalogueEntry[]>;
  /** Images to send: the file itself for an image, rendered pages for a PDF. */
  pages: (file: { bytes: Uint8Array; mime: EvidenceMime }) => Promise<Result<ImagePage[]>>;
  /** Today in Vietnam, `YYYY-MM-DD`. */
  today: string;
};

const MESSAGE: Record<AiErrorCode, string> = {
  disabled: "AI reading is not available right now. Fill in the form by hand.",
  daily_limit: "You have used all of today's AI reads. Fill in the form by hand, or try again tomorrow.",
  unreadable: "The AI could not read this file. Fill in the form by hand.",
  timeout: "The AI took too long to answer. Fill in the form by hand, or try again.",
  provider_error: "The AI could not read this file right now. Fill in the form by hand.",
  invalid_output: "The AI could not read this file right now. Fill in the form by hand.",
};

/**
 * Turns the model's answer into form values. The catalogue decides what is real: an id the server did not send becomes null,
 * the matched entry's kind wins, a field under the threshold (or with no confidence) stays empty, and a date after today is dropped.
 */
export function applySuggestion(
  result: ExtractResult,
  confidence: Record<string, number>,
  catalogue: CatalogueEntry[],
  threshold: number,
  today: string,
): CertificateSuggestion {
  const sure = (field: string): boolean => (confidence[field] ?? 0) >= threshold;
  const aiFields: CertificateSuggestion["aiFields"] = [];

  const matched = result.certificateId && sure("certificateId") ? catalogue.find((entry) => entry.id === result.certificateId) : undefined;
  if (matched) aiFields.push("certificateId");

  const [dateField, date] = result.kind === "exam" ? (["issuedDate", result.issuedDate] as const) : (["completedDate", result.completedDate] as const);
  // ISO dates compare correctly as strings.
  const issuedDate = date && sure(dateField) && date <= today ? date : null;
  if (issuedDate) aiFields.push("issuedDate");

  const certificateUrl = result.kind === "exam" && result.verifyUrl && sure("verifyUrl") ? result.verifyUrl : null;
  if (certificateUrl) aiFields.push("certificateUrl");

  const validUntil = result.kind === "exam" && result.validUntil && sure("validUntil") ? result.validUntil : null;

  const text = (value: string | null): string | null => value?.trim() || null;
  const readName = text(result.kind === "exam" ? result.certificateName : result.courseName);

  return {
    kind: matched?.kind ?? result.kind,
    certificateId: matched?.id ?? null,
    issuedDate,
    certificateUrl,
    validUntil,
    readName,
    readProvider: text(result.provider),
    aiFields,
  };
}

/** The existing provider a read name points at (ignoring case and surrounding spaces), or null. */
export function findProviderId(name: string | null, providers: { id: string; name: string }[]): string | null {
  const wanted = name?.trim().toLowerCase();
  return wanted ? (providers.find((provider) => provider.name.trim().toLowerCase() === wanted)?.id ?? null) : null;
}

export async function readCertificate(deps: ReadDeps, input: { memberCode: string; file: File }): Promise<Result<CertificateSuggestion>> {
  const { file, memberCode } = input;
  // All file checks come first: a refused file never reaches the provider and never uses a call of the daily limit.
  if (file.size === 0) return err(EVIDENCE_EMPTY_MESSAGE);
  if (file.size > MAX_EVIDENCE_BYTES) return err(EVIDENCE_TOO_LARGE_MESSAGE);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffEvidenceType(bytes);
  if (!mime) return err(EVIDENCE_WRONG_TYPE_MESSAGE);

  const claim = await deps.usage.claim(FEATURE, memberCode);
  if (!claim.ok) return err(MESSAGE[claim.reason]);

  const finish = (outcome: Parameters<UsageStore["finish"]>[1]["outcome"], usage = { inputTokens: 0, outputTokens: 0 }) =>
    deps.usage.finish(claim.usageId, { ...usage, costMicroUsd: estimateCostMicroUsd(usage, deps.rates), outcome });

  try {
    const pages = await deps.pages({ bytes, mime });
    if (!pages.ok) {
      await finish("unreadable");
      return err(pages.error);
    }
    const catalogue = (await deps.catalogue()).slice(0, MAX_CATALOGUE);
    const raw = await deps.gateway.extractCertificate({ feature: FEATURE, requestedBy: memberCode, pages: pages.data, catalogue });

    // Parse again: the gateway may be a remote service, and this strips any field the contract does not name (the holder's name).
    const parsed = extractResponseSchema.safeParse(raw);
    if (!parsed.success) {
      await finish("invalid_output");
      return err(MESSAGE.invalid_output);
    }
    if (!parsed.data.ok) {
      const code = parsed.data.error;
      // disabled and daily_limit are decided before the call; a gateway that returns them used no call of ours.
      await finish(code === "disabled" || code === "daily_limit" ? "provider_error" : code);
      return err(MESSAGE[code]);
    }
    await finish("ok", parsed.data.usage);
    return ok(applySuggestion(parsed.data.result, parsed.data.confidence, catalogue, deps.threshold, deps.today));
  } catch {
    await finish("provider_error");
    return err(MESSAGE.provider_error);
  }
}
