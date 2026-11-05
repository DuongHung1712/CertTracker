/** YoE in years as shown to people: "3.5 years", "1 year", "0 years", "Not set" without a career start. */
export function formatYoe(years: number | null): string {
  if (years === null) return "Not set";
  return `${years} ${years === 1 ? "year" : "years"}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
export { MONTH_NAMES };

/** `2020-03-01` → `March 2020`; null → `Not set`. The stored date is always the first of a month. */
export function formatCareerStart(date: string | null): string {
  if (!date) return "Not set";
  const [year, month] = date.split("-").map(Number) as [number, number];
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
