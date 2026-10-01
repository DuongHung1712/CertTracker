const FORMULA_START = /^[=+\-@\t\r]/;

/** OWASP CSV injection guard: a text cell that a spreadsheet would evaluate gets a leading apostrophe. Real numbers are untouched. */
export function escapeCsvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** UTF-8 BOM so Excel on Windows opens Vietnamese text correctly; CRLF row terminators. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return `\uFEFF${[headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}\r\n`;
}
