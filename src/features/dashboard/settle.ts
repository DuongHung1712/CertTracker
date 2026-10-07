import { err, ok, type Result } from "@/lib/result";

/**
 * One failing query must not take the whole dashboard down (and, because every e2e test lands on
 * /dashboard after signing in, must not take the suite down either): each section settles on its
 * own and renders its own error. Only the message is logged — never the payload.
 */
export async function settle<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return ok(await promise);
  } catch (error) {
    console.error("dashboard section failed", error instanceof Error ? error.message : error);
    return err("Không tải được dữ liệu.");
  }
}
