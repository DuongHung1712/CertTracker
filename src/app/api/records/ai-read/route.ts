import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/queries";
import { listCertificates } from "@/features/certificates/queries";
import { readCertificate, type ReadDeps } from "@/features/records/ai-read";
import { AiConfigError, createAiGateway } from "@/lib/ai/gateway";
import { ratesFromEnv } from "@/lib/ai/limits";
import { pdfToImages } from "@/lib/ai/pdf-pages";
import { createUsageStore } from "@/lib/ai/usage-store";
import { todayVn } from "@/lib/dates";
import { ok } from "@/lib/result";
import { MAX_EVIDENCE_BYTES } from "@/lib/storage/evidence";
import { createClient } from "@/lib/supabase/server";

// Same budget as the import route: the provider call has its own 45 s limit inside this.
export const maxDuration = 60;
const MULTIPART_OVERHEAD = 64 * 1024;
const DEFAULT_THRESHOLD = 0.6;
const UNAVAILABLE = "AI reading is not available right now. Fill in the form by hand.";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/** A threshold outside 0–1, or not a number, falls back to the default rather than switching the check off. */
function thresholdFromEnv(raw: string | undefined): number {
  const value = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_THRESHOLD;
}

/** The daily-limit key: the member code, or for an admin with no member row a short pseudonym from the user id (never a name or e-mail). */
async function limitKey(user: { id: string; memberId: string | null }): Promise<string> {
  if (user.memberId) {
    const { data } = await (await createClient()).from("members").select("code").eq("id", user.memberId).maybeSingle();
    if (data?.code) return data.code;
  }
  return `U-${user.id.slice(0, 8)}`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Your session has expired. Sign in again and retry.", 401);

  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_EVIDENCE_BYTES + MULTIPART_OVERHEAD) return fail("That file is larger than 4 MB. Compress it or choose a smaller file, then try again.", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Invalid request.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Choose a file first.", 400);

  let gateway: ReadDeps["gateway"];
  try {
    gateway = createAiGateway();
  } catch (cause) {
    // A misconfigured gateway must not break the form: say it is unavailable and log why for the operator.
    if (cause instanceof AiConfigError) console.error("ai gateway config", cause.message);
    return fail(UNAVAILABLE, 503);
  }

  const result = await readCertificate(
    {
      gateway,
      usage: createUsageStore(),
      rates: ratesFromEnv(),
      threshold: thresholdFromEnv(process.env.AI_CONFIDENCE_THRESHOLD),
      catalogue: async () =>
        (await listCertificates())
          .filter((row) => row.catalogueStatus === "approved")
          .map((row) => ({ id: row.id, kind: row.kind, name: row.name, provider: row.providerName })),
      pages: async ({ bytes, mime }) =>
        mime === "application/pdf" ? pdfToImages(bytes) : ok([{ mime, bytesBase64: Buffer.from(bytes).toString("base64") }]),
      today: todayVn(),
    },
    { memberCode: await limitKey(user), file },
  );
  return result.ok ? NextResponse.json({ suggestion: result.data }) : fail(result.error, 422);
}
