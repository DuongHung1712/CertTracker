import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/queries";
import { BatchPreview } from "@/features/import/components/batch-preview";
import { getImportBatch, listImportRows } from "@/features/import/queries";
import { batchIdSchema } from "@/features/import/schema";

export default async function ImportBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const user = await getCurrentUser();
  // UX only: RLS on the import tables is the real guard.
  if (user?.role !== "admin") redirect("/dashboard");

  const { batchId } = await params;
  // The queries do not validate ids and throw on a non-uuid, so reject it here.
  const parsed = batchIdSchema.safeParse({ batchId });
  if (!parsed.success) notFound();
  const batch = await getImportBatch(parsed.data.batchId);
  if (!batch) notFound();
  const rows = await listImportRows(batch.id);

  return <BatchPreview batch={batch} rows={rows} />;
}
