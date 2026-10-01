import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/queries";
import { MAX_IMPORT_BYTES } from "@/features/import/clean";
import { cleanupPartialBatch } from "@/features/import/cleanup";
import { buildImportPlan } from "@/features/import/plan";
import { loadImportLookups } from "@/features/import/queries";
import { capMessages, capRaw, sanitizeJson, truncateText } from "@/features/import/stored";
import { isExcelFile, readImportTable } from "@/features/import/workbook";
import { todayVn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

// Runs on the Node.js runtime (the default): the workbook reader needs node:zlib.
export const maxDuration = 60;
const CHUNK = 500;
const MULTIPART_OVERHEAD = 64 * 1024;
const TOO_LARGE = "File lớn hơn 4 MB. Chia nhỏ file rồi nhập từng phần.";
/** Cleanup steps for a batch whose upload failed; each reports whether it really changed the row. */
async function removeBatch(batchId: string): Promise<boolean> {
  const { data, error } = await (await createClient()).from("import_batches").delete().eq("id", batchId).select("id");
  return !error && data.length > 0;
}

async function discardBatch(batchId: string): Promise<boolean> {
  const { data, error } = await (await createClient())
    .from("import_batches")
    .update({ status: "discarded" })
    .eq("id", batchId)
    .eq("status", "parsed")
    .select("id");
  return !error && data.length > 0;
}

const cleanup = (batchId: string) =>
  cleanupPartialBatch(batchId, { remove: () => removeBatch(batchId), discard: () => discardBatch(batchId) });
const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("Phiên đăng nhập đã hết. Đăng nhập lại rồi thử lại.", 401);
  // Early exit only — RLS on import_batches is the real guard.
  if (user.role !== "admin") return fail("Chỉ quản trị viên được nhập dữ liệu.", 403);

  // Refuse an oversized body before buffering it (multipart framing adds a little to the file size).
  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_IMPORT_BYTES + MULTIPART_OVERHEAD) return fail(TOO_LARGE, 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Yêu cầu không hợp lệ.", 400);
  }
  const file = form.get("file");
  if (!(file instanceof File)) return fail("Chưa chọn file.", 400);
  if (file.size === 0) return fail("File rỗng.", 400);
  if (file.size > MAX_IMPORT_BYTES) return fail(TOO_LARGE, 413);

  let batchId: string | null = null;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isExcelFile(bytes)) return fail("Chỉ nhận file Excel (.xlsx hoặc .xls).", 415);

    const table = readImportTable(bytes);
    if (!table.ok) return fail(table.error, 422);

    const supabase = await createClient();
    const plan = buildImportPlan(table.value, await loadImportLookups(), todayVn());
    // The file name is only a label (truncated surrogate-safely, never used as a path).
    const fileName = truncateText(file.name, 255).trim() || "import.xlsx";
    // expected_rows lets commit_import refuse a batch whose rows were only partly written (a killed upload).
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        file_name: fileName,
        sheet_name: truncateText(table.value.sheetName, 255),
        notes: capMessages(plan.notes),
        expected_rows: plan.rows.length,
      })
      .select("id")
      .single();
    if (batchError) return fail("Không tạo được lô nhập. Vui lòng thử lại.", 500);
    batchId = batch.id;

    for (let i = 0; i < plan.rows.length; i += CHUNK) {
      const { error } = await supabase.from("import_rows").insert(
        plan.rows.slice(i, i + CHUNK).map((row) => ({
          batch_id: batch.id,
          row_no: row.rowNumber,
          raw: capRaw(row.raw),
          normalized: row.normalized && sanitizeJson(row.normalized),
          action: row.action,
          errors: capMessages(row.errors),
          warnings: capMessages(row.warnings),
        })),
      );
      if (error) {
        // A half-written batch must never stay committable: delete it, or at least mark it discarded.
        await cleanup(batch.id);
        return fail("Không lưu được dữ liệu kiểm tra. Vui lòng thử lại.", 500);
      }
    }
    return NextResponse.json({ batchId: batch.id }, { status: 201 });
  } catch {
    // Never leak an internal error or stack trace to the client. If the batch row was created, make sure
    // it cannot be committed with a partial set of rows (the helper never throws).
    if (batchId) await cleanup(batchId);
    return fail("Có lỗi xảy ra khi xử lý file. Vui lòng thử lại.", 500);
  }
}
