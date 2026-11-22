import type { AiGateway } from "@/lib/ai/gateway";
import type { ExtractRequest, ExtractResponse } from "@/lib/ai/contract";

/** Sample answers for dev and tests. Dates are fixed and in the past; the id echoes the first catalogue entry so a matched form can be tried. */
export class FakeGateway implements AiGateway {
  readonly transport = "fake" as const;

  async extractCertificate(request: ExtractRequest): Promise<ExtractResponse> {
    const first = request.catalogue[0];
    const certificateId = first?.id ?? null;
    const usage = { inputTokens: 1000, outputTokens: 100 };
    if (first?.kind === "completion") {
      return {
        ok: true,
        result: { kind: "completion", certificateId, courseName: first.name, provider: first.provider, completedDate: "2026-02-01" },
        confidence: { certificateId: 0.9, completedDate: 0.9 },
        usage,
      };
    }
    return {
      ok: true,
      result: {
        kind: "exam",
        certificateId,
        certificateName: first?.name ?? "Sample Exam Certificate",
        provider: first?.provider ?? "Sample Provider",
        issuedDate: "2026-03-14",
        validUntil: "2029-03-14",
        verifyUrl: "https://example.com/verify/sample",
      },
      confidence: { certificateId: 0.9, issuedDate: 0.9, validUntil: 0.8, verifyUrl: 0.7 },
      usage,
    };
  }
}
