export const CURRENCIES = ["VND", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Narrows a free string (a database column, a form value) to a currency; anything else is `null`. */
export function toCurrency(value: string | null | undefined): Currency | null {
  return CURRENCIES.find((currency) => currency === value) ?? null;
}

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `150, "USD"` → `$150`; `1234.5, "USD"` → `$1,234.50`; `3500000, "VND"` → `3,500,000 ₫`. */
export function formatMoney(amount: number, currency: Currency): string {
  if (currency === "VND") return `${wholeNumber.format(amount)} ₫`;
  const cents = Math.round(amount * 100);
  return cents % 100 === 0 ? usdWhole.format(cents / 100) : usdCents.format(cents / 100);
}

/**
 * Totals per currency, joined with " + " (USD first): `$1,200 + 15,000,000 ₫`. Amounts in different currencies are never
 * added together, and an empty list is `—`.
 */
export function formatMoneyTotals(items: { amount: number; currency: Currency }[]): string {
  const parts = (["USD", "VND"] as const).flatMap((currency) => {
    const own = items.filter((item) => item.currency === currency);
    if (own.length === 0) return [];
    const total = own.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
    return [formatMoney(total, currency)];
  });
  return parts.length > 0 ? parts.join(" + ") : "—";
}
