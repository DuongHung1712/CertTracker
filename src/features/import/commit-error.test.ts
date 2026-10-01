import { describe, expect, it } from "vitest";
import { mapCommitError } from "@/features/import/commit-error";

describe("mapCommitError", () => {
  it("maps a discarded batch", () => {
    expect(mapCommitError({ code: "55000", message: "import batch was discarded" })).toBe("Lô này đã bị hủy, không nhập được.");
  });

  it("maps a missing batch", () => {
    expect(mapCommitError({ code: "P0002", message: "import batch not found" })).toBe("Không tìm thấy lô nhập.");
  });

  it("maps a statement timeout", () => {
    expect(mapCommitError({ code: "57014", message: "canceling statement due to statement timeout" })).toContain("hết thời gian");
  });

  it("adds the Excel row number for a check violation", () => {
    const text = mapCommitError({ code: "23514", message: 'import row 7: new row violates check constraint "x"' });
    expect(text).toBe("Dòng 7: Trạng thái, tiến độ và ngày cấp không khớp nhau. Không có dữ liệu nào được nhập.");
  });

  it("maps duplicate and FK failures with the row number", () => {
    expect(mapCommitError({ code: "23505", message: "import row 12: duplicate key" })).toMatch(/^Dòng 12: Dữ liệu trùng/);
    expect(mapCommitError({ code: "23503", message: "import row 3: fk" })).toMatch(/^Dòng 3: Dữ liệu tham chiếu/);
  });

  it("never leaks the raw database message", () => {
    const text = mapCommitError({ code: "XX000", message: "import row 9: secret_table detail" });
    expect(text).toBe("Dòng 9: Có lỗi xảy ra. Vui lòng thử lại. Không có dữ liệu nào được nhập.");
    expect(text).not.toContain("secret_table");
  });

  it("has no row prefix for an error without one", () => {
    expect(mapCommitError({ code: "42501", message: "only admins can commit an import" })).toBe(
      "Bạn không có quyền thực hiện thao tác này. Không có dữ liệu nào được nhập.",
    );
  });
});
