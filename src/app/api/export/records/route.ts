import { getCurrentUser } from "@/features/auth/queries";
import { listMemberCareers } from "@/features/career/queries";
import { recordsToCsv, recordsToXlsx, withCareerColumns, type ExportRow } from "@/features/export/records-export";
import { listRecords } from "@/features/records/queries";
import { todayVn } from "@/lib/dates";

// Node.js runtime (default): the xlsx writer is not edge-safe.
export const maxDuration = 60;

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  // Validate the cheap input first: no auth or DB work for a malformed request.
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "csv" && format !== "xlsx") return new Response("Định dạng không hợp lệ.", { status: 400 });
  // Early exit only — RLS (through listRecords' user-scoped client) decides which rows come back.
  if (!(await getCurrentUser())) return new Response("Chưa đăng nhập.", { status: 401 });

  let rows: ExportRow[];
  try {
    // admin: all, manager: their teams (+ own), member: own. The career profiles follow the same members RLS.
    const [records, careers] = await Promise.all([listRecords(), listMemberCareers()]);
    rows = withCareerColumns(records, careers);
  } catch (error) {
    // Includes fetchAllRows refusing to truncate at its row cap: an incomplete export must never look complete.
    console.error("export: could not load records", error);
    return new Response("Không xuất được dữ liệu. Vui lòng thử lại.", { status: 500 });
  }
  const headers = {
    "Content-Disposition": `attachment; filename="certtracker-chung-chi-${todayVn()}.${format}"`,
    "Cache-Control": "no-store",
    "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : XLSX_TYPE,
  };
  return new Response(format === "csv" ? recordsToCsv(rows) : recordsToXlsx(rows), { headers });
}
