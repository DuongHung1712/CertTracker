import type { Result } from "@/lib/result";

/**
 * Runs a commit/discard Server Action and routes its three outcomes. A Server Action can REJECT (network
 * drop, deployment skew) as well as return `{ ok: false }`; the caller must recover from both, so
 * `onSettled` always runs: reset pending state, close the dialog, re-read the batch from the server.
 */
export async function runBatchAction<T>(
  action: () => Promise<Result<T>>,
  handlers: {
    onOk: (data: T) => void;
    onError: (message: string) => void;
    /** The call itself failed, so whether it took effect on the server is unknown. */
    onRejected: () => void;
    onSettled: () => void;
  },
): Promise<void> {
  try {
    let result: Result<T>;
    try {
      result = await action();
    } catch {
      handlers.onRejected();
      return;
    }
    if (result.ok) handlers.onOk(result.data);
    else handlers.onError(result.error);
  } finally {
    handlers.onSettled();
  }
}
