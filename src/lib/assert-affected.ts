import { err, type Result } from "@/lib/result";

/**
 * PostgREST applies RLS `USING` on UPDATE/DELETE as a row filter, not an authorization check: a
 * caller who isn't allowed to touch the row gets `error: null` and zero affected rows, not 42501
 * (only INSERT/`with check` violations raise an error). Chain `.select("id")` on every update/
 * delete call and pass the returned `data` here — when it's empty, RLS silently discarded the
 * write and the caller must not report success.
 */
export function assertAffected(data: unknown[] | null): Result<null> | null {
  if (data && data.length > 0) return null;
  return err("Bạn không có quyền thực hiện thao tác này hoặc dữ liệu không còn tồn tại.");
}
