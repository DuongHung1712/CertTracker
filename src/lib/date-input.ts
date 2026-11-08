const ISO_PASTE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHORT_PASTE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Shapes typed or pasted text into `dd/mm/yyyy`; it does not validate (`toIsoDate` does). */
export function formatDateInput(raw: string): string {
  const iso = ISO_PASTE.exec(raw);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const short = SHORT_PASTE.exec(raw);
  if (short) return `${short[1].padStart(2, "0")}/${short[2].padStart(2, "0")}/${short[3]}`;

  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}
