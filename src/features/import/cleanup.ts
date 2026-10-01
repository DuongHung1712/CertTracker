/** One cleanup step: resolves true only when it really removed/closed the batch; may reject. */
export type CleanupStep = () => PromiseLike<boolean>;

async function attempt(step: CleanupStep): Promise<boolean> {
  try {
    return await step();
  } catch {
    return false;
  }
}

/**
 * Called when a parse failed after the batch row was created. A batch left in `parsed` with only some
 * of its rows could later be committed as if it were the whole file, so it must never stay committable:
 * first try to delete it (rows cascade); if that fails (likely the same DB/network problem that broke the
 * upload), mark it `discarded`, which `commit_import` refuses. If both fail, log the id only (no payload).
 * Never throws, so the caller can still answer with its own generic error.
 */
export async function cleanupPartialBatch(batchId: string, steps: { remove: CleanupStep; discard: CleanupStep }): Promise<void> {
  if (await attempt(steps.remove)) return;
  if (await attempt(steps.discard)) return;
  console.error(`import: could not remove or discard partial batch ${batchId}; it must be discarded manually`);
}
