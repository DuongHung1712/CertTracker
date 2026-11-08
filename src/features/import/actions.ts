"use server";

import { revalidatePath } from "next/cache";
import { mapCommitError } from "@/features/import/commit-error";
import { batchIdSchema, importSummarySchema, type ImportSummary } from "@/features/import/schema";
import { mapPostgresError } from "@/lib/postgres-error";
import { err, ok, type Result } from "@/lib/result";
import { createClient } from "@/lib/supabase/server";

function revalidateAfterImport(batchId: string) {
  for (const path of ["/import", `/import/${batchId}`, "/records", "/me", "/members", "/courses"]) revalidatePath(path);
}

/** Admin only: `commit_import` runs as the caller, so RLS and the role check inside the function both apply. */
export async function commitImport(input: { batchId: string }): Promise<Result<ImportSummary>> {
  const parsed = batchIdSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commit_import", { p_batch_id: parsed.data.batchId });
  if (error) return err(mapCommitError(error));
  const summary = importSummarySchema.safeParse(data);
  if (!summary.success) return err("Something went wrong. Try again.");
  revalidateAfterImport(parsed.data.batchId);
  return ok(summary.data);
}

export async function discardImport(input: { batchId: string }): Promise<Result<null>> {
  const parsed = batchIdSchema.safeParse(input);
  if (!parsed.success) return err("Invalid data");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .update({ status: "discarded" })
    .eq("id", parsed.data.batchId)
    .eq("status", "parsed")
    .select("id");
  if (error) return err(mapPostgresError(error));
  // Zero rows: already committed/discarded, missing, or hidden by RLS (a non-admin).
  if (!data || data.length === 0) return err("This batch was already imported or discarded, or you do not have permission.");
  revalidateAfterImport(parsed.data.batchId);
  return ok(null);
}
