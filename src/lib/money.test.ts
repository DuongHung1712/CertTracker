import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyTotals } from "@/lib/money";

describe("formatMoney", () => {
  it("formats USD with a dollar sign and no decimals for whole amounts", () => {
    expect(formatMoney(150, "USD")).toBe("$150");
    expect(formatMoney(1200, "USD")).toBe("$1,200");
  });

  it("shows two decimals for USD only when the amount is not whole", () => {
    expect(formatMoney(1234.5, "USD")).toBe("$1,234.50");
    expect(formatMoney(0.99, "USD")).toBe("$0.99");
    expect(formatMoney(10.125, "USD")).toBe("$10.13");
  });

  it("formats VND with a trailing dong sign, English separators and no decimals", () => {
    expect(formatMoney(3_500_000, "VND")).toBe("3,500,000 ₫");
    expect(formatMoney(999, "VND")).toBe("999 ₫");
    expect(formatMoney(1500.4, "VND")).toBe("1,500 ₫");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "USD")).toBe("$0");
    expect(formatMoney(0, "VND")).toBe("0 ₫");
  });
});

describe("formatMoneyTotals", () => {
  it("shows a dash for no items", () => {
    expect(formatMoneyTotals([])).toBe("—");
  });

  it("shows a single currency as one amount, summing its items", () => {
    expect(formatMoneyTotals([{ amount: 100, currency: "USD" }, { amount: 50.5, currency: "USD" }])).toBe("$150.50");
    expect(formatMoneyTotals([{ amount: 1_000_000, currency: "VND" }])).toBe("1,000,000 ₫");
  });

  it("never sums different currencies: one amount per currency, USD first", () => {
    expect(
      formatMoneyTotals([
        { amount: 15_000_000, currency: "VND" },
        { amount: 700, currency: "USD" },
        { amount: 500, currency: "USD" },
      ]),
    ).toBe("$1,200 + 15,000,000 ₫");
  });

  it("keeps a currency whose total is zero", () => {
    expect(formatMoneyTotals([{ amount: 0, currency: "USD" }, { amount: 2_000, currency: "VND" }])).toBe("$0 + 2,000 ₫");
  });
});
