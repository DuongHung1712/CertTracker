import { mapPostgresError } from "@/lib/postgres-error";

/**
 * Turns a `commit_import` failure into an English message. The function re-raises row failures as
 * `import row N: <original message>` with the original SQLSTATE, so the code still classifies the cause.
 * The raw message is never shown, only the row number extracted from it.
 */
export function mapCommitError(error: { code?: string | null; message: string }): string {
  if (error.code === "55000") return "This batch was discarded, so it cannot be imported.";
  // 22023: fewer or more rows stored than the parse announced (an interrupted upload); see commit_import.
  if (error.code === "22023") return "This batch was not fully uploaded, so it cannot be imported. Discard the batch and upload the file again.";
  if (error.code === "P0002") return "Import batch not found.";
  if (error.code === "57014") return "The batch is too large and timed out. Split the file and import it again.";
  const rowNo = /^import row (\d+):/.exec(error.message)?.[1];
  const reason = mapPostgresError(error, {
    invalid: "Status, progress and issue date do not match.",
    restricted: "Reference data changed since the check. Upload the file again to re-check it.",
    duplicate: "The data duplicates an existing record. Upload the file again to re-check it.",
  });
  return `${rowNo ? `Row ${rowNo}: ` : ""}${reason} Nothing was imported.`;
}
