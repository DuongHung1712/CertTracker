import { describe, expect, it } from "vitest";
import { mapPostgresError } from "@/lib/postgres-error";

describe("mapPostgresError", () => {
  it("maps a unique violation to a Vietnamese duplicate message", () => {
    expect(mapPostgresError({ code: "23505", message: "duplicate key" })).toBe("Dữ liệu này đã tồn tại.");
  });

  it("prefers a caller-supplied duplicate message", () => {
    expect(
      mapPostgresError({ code: "23505", message: "duplicate key" }, { duplicate: 'Tên trung tâm "HN" đã tồn tại.' }),
    ).toBe('Tên trung tâm "HN" đã tồn tại.');
  });

  it("maps a foreign key violation to a restricted-delete message", () => {
    expect(mapPostgresError({ code: "23503", message: "violates foreign key" })).toBe(
      "Không thể xóa vì đang được dữ liệu khác sử dụng.",
    );
  });

  it("prefers a caller-supplied restricted message", () => {
    expect(
      mapPostgresError(
        { code: "23503", message: "violates foreign key" },
        { restricted: "Trung tâm đang có chương trình sử dụng. Xóa các chương trình trước." },
      ),
    ).toBe("Trung tâm đang có chương trình sử dụng. Xóa các chương trình trước.");
  });

  it("maps an RLS violation to a permission message", () => {
    expect(mapPostgresError({ code: "42501", message: "row-level security" })).toBe(
      "Bạn không có quyền thực hiện thao tác này.",
    );
  });

  it("falls back to a generic message for anything else", () => {
    expect(mapPostgresError({ code: "XX000", message: "boom" })).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
    expect(mapPostgresError({ message: "boom" })).toBe("Có lỗi xảy ra. Vui lòng thử lại.");
  });
});
