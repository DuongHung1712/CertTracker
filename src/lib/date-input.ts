const ISO_PASTE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SINGLE_DIGIT = /^[1-9]$/;

function maskDigits(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

/**
 * Shapes typed or pasted text into `dd/mm/yyyy`; it does not validate (`toIsoDate` does).
 * Digits only get the mask. Text with slashes keeps the slashes the user typed and pads a day or
 * month of 1-9 once the next part has started (a lone 0 stays, so a digit can be replaced).
 */
export function formatDateInput(raw: string): string {
  const text = raw.trim();
  const iso = ISO_PASTE.exec(text);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  if (!text.includes("/")) return maskDigits(text);

  const groups = text.replace(/^\/+/, "").split("/").map((group) => group.replace(/\D/g, ""));
  let day = groups[0] ?? "";
  let month = groups[1] ?? "";
  let year = groups.slice(2).join("");
  if (day.length > 2) [day, month] = [day.slice(0, 2), day.slice(2) + month];
  if (month.length > 2) [month, year] = [month.slice(0, 2), month.slice(2) + year];

  const slashes = Math.max(Math.min(groups.length - 1, 2), year ? 2 : month ? 1 : 0);
  const pad = (part: string, needed: number) => (slashes >= needed && SINGLE_DIGIT.test(part) ? `0${part}` : part);
  return [pad(day, 1), pad(month, 2), year.slice(0, 4)].slice(0, slashes + 1).join("/");
}
