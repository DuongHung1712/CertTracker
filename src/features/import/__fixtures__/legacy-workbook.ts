import * as XLSX from "xlsx";

/** Synthetic legacy sheet (no real personal data). Rows reference supabase/seed.sql. */
export function buildLegacyWorkbook(): Uint8Array {
  const aoa: (string | number | null)[][] = [
    ["DANH SÁCH CHỨNG CHỈ DC34"],                                                                              // row 1
    [],                                                                                                          // row 2
    ["STT", "Họ và tên", "Email", "Team", "Chứng chỉ", "Provider", "Loại", "Thời hạn", "Trạng thái", "Tiến độ", "Ngày thi dự kiến", "Ngày cấp", "Ghi chú"], // row 3
    [1, "Nguyễn Văn An", " AN@certtracker.test ", "Team Cloud", "AWS Solutions Architect Associate", "AWS", "Cloud", 36, "Completed", 1, null, 45000, null],        // 4 update
    [2, null, null, null, "Google Cloud Digital Leader", "Google", "Cloud", 36, "đang ôn thi", "45%", null, null, null],                                             // 5 create (merged An)
    [3, "Trần Thị Bình", "binh@certtracker.test", "Team AI", "NVIDIA Generative AI LLMs", "NVIDIA", "AI", null, "Đang học", 0.6, "15/12/2026", null, "ôn chương 3"], // 6 update
    [4, "Lê Minh Châu", "member@certtracker.test", "Team Cloud", "  Azure   Fundamentals ", "Microsoft", "  Cloud ", "24", "xong", 1, null, "01/08/2025", null],    // 7 create
    [5, "Phạm Thu Hà", "ha.pham@certtracker.test", "Team AI", "Azure Fundamentals", "microsoft", "Cloud", 24, "Not started", 0, null, null, null],                 // 8 create + new member
    [],                                                                                                                                                              // 9 blank
    [6, "Phạm Thu Hà", "HA.PHAM@certtracker.test", "Team AI", "Azure Fundamentals", "Microsoft", "Cloud", 24, "Đang học", 0.3, null, null, null],                  // 10 duplicate of 8
    [7, "Người Lạ", "la@certtracker.test", "Team Ghost", "AWS Solutions Architect Associate", "AWS", "Cloud", null, "Hoàn thành", 1, null, null, null],            // 11 unknown team + missing issue date
    [8, "Trần Thị Bình", "binh@certtracker.test", "Team AI", "AWS Solutions Architect Associate", "AWS", "Cloud", null, "Failed", 0.5, null, null, null],          // 12 unknown status
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  // Title spans the header width; An's name, email and team are merged over rows 4–5.
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
    { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
    { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Chứng chỉ");
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** What the preview must show for the fixture on a freshly seeded database. */
export const LEGACY_EXPECTED = {
  create: [5, 7, 8],
  update: [4, 6],
  unchanged: [] as number[],
  error: [10, 11, 12],
  newMembers: ["Phạm Thu Hà"],
  newProviders: ["Google", "Microsoft"],
  newCertTypes: [] as string[],
  newCourses: ["Google Cloud Digital Leader", "Azure Fundamentals"],
};
