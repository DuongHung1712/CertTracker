/** Postgres SQLSTATE codes this app maps to a Vietnamese message. */
const DUPLICATE = "23505";
const RESTRICTED = "23503";
const FORBIDDEN = "42501";
const INVALID = "23514";

/** Never show a raw Postgres/PostgREST error message to a user. */
export function mapPostgresError(
  error: { code?: string | null; message: string },
  messages: { duplicate?: string; restricted?: string; invalid?: string } = {},
): string {
  switch (error.code) {
    case DUPLICATE:
      return messages.duplicate ?? "Dữ liệu này đã tồn tại.";
    case RESTRICTED:
      return messages.restricted ?? "Không thể xóa vì đang được dữ liệu khác sử dụng.";
    case INVALID:
      return messages.invalid ?? "Dữ liệu không khớp quy tắc của hệ thống.";
    case FORBIDDEN:
      return "Bạn không có quyền thực hiện thao tác này.";
    default:
      return "Có lỗi xảy ra. Vui lòng thử lại.";
  }
}
