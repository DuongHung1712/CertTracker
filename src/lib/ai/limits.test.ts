import { describe, expect, it } from "vitest";
import { estimateCostMicroUsd, ratesFromEnv } from "@/lib/ai/limits";

describe("ratesFromEnv", () => {
  it("defaults to the flash peak prices", () => {
    expect(ratesFromEnv({})).toEqual({ inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2 });
  });
  it("reads an override", () => {
    expect(ratesFromEnv({ AI_PRICE_INPUT_PER_M: "0.15", AI_PRICE_OUTPUT_PER_M: "0.6" })).toEqual({ inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 });
  });
  it.each(["abc", "-1", "", "NaN", "Infinity"])("falls back to the default for %j", (bad) => {
    expect(ratesFromEnv({ AI_PRICE_INPUT_PER_M: bad, AI_PRICE_OUTPUT_PER_M: bad })).toEqual({ inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2 });
  });
});

describe("estimateCostMicroUsd", () => {
  const rates = ratesFromEnv({});
  it("prices one million input tokens at the input rate", () => {
    expect(estimateCostMicroUsd({ inputTokens: 1_000_000, outputTokens: 0 }, rates)).toBe(300_000);
  });
  it("adds output tokens at the output rate", () => {
    expect(estimateCostMicroUsd({ inputTokens: 0, outputTokens: 1_000_000 }, rates)).toBe(1_200_000);
  });
  it("rounds up so one token is never free", () => {
    expect(estimateCostMicroUsd({ inputTokens: 1, outputTokens: 0 }, rates)).toBe(1);
  });
  it("is zero for no usage", () => {
    expect(estimateCostMicroUsd({ inputTokens: 0, outputTokens: 0 }, rates)).toBe(0);
  });
  it("is an integer", () => {
    expect(Number.isInteger(estimateCostMicroUsd({ inputTokens: 1450, outputTokens: 120 }, rates))).toBe(true);
  });
});
