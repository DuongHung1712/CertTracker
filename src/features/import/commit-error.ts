import { mapPostgresError } from "@/lib/postgres-error";

/**
 * Turns a `commit_import` failure into a Vietnamese message. The function re-raises row failures as
 * `import row N: <original message>` with the original SQLSTATE, so the code still classifies the cause.
 * The raw message is never shown, only the row number extracted from it.
 */
export function mapCommitError(error: { code?: string | null; message: string }): string {
  if (error.code === "55000") return "Lô này đã bị hủy, không nhập được.";
  // 22023: fewer or more rows stored than the parse announced (an interrupted upload); see commit_import.
  if (error.code === "22023") return "Lô này chưa tải lên đủ dữ liệu nên không nhập được. Hủy lô rồi tải file lên lại.";
  if (error.code === "P0002") return "Không tìm thấy lô nhập.";
  if (error.code === "57014") return "Lô quá lớn, hết thời gian xử lý. Chia nhỏ file rồi nhập lại.";
  const rowNo = /^import row (\d+):/.exec(error.message)?.[1];
  const reason = mapPostgresError(error, {
    invalid: "Trạng thái, tiến độ và ngày cấp không khớp nhau.",
    restricted: "Dữ liệu tham chiếu đã thay đổi từ lúc kiểm tra. Tải lại file để kiểm tra lại.",
    duplicate: "Dữ liệu trùng với bản ghi đã có. Tải lại file để kiểm tra lại.",
  });
  return `${rowNo ? `Dòng ${rowNo}: ` : ""}${reason} Không có dữ liệu nào được nhập.`;
}
