export type Rates = { inputPerMillionUsd: number; outputPerMillionUsd: number };

const DEFAULT_INPUT_PER_M = 0.3;
const DEFAULT_OUTPUT_PER_M = 1.2;

/** A price must be a positive finite number; anything else (empty, text, negative) falls back to the default. */
const price = (raw: string | undefined, fallback: number): number => {
  const value = raw === undefined || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Defaults are the deepseek-flash peak prices (decision #52 table of 2026-11-22), so the logged estimate is an upper bound. */
export function ratesFromEnv(env: Record<string, string | undefined> = process.env): Rates {
  return {
    inputPerMillionUsd: price(env.AI_PRICE_INPUT_PER_M, DEFAULT_INPUT_PER_M),
    outputPerMillionUsd: price(env.AI_PRICE_OUTPUT_PER_M, DEFAULT_OUTPUT_PER_M),
  };
}

/** USD per million tokens equals micro-USD per token. Rounded up to an integer; toFixed first so float noise never adds one. */
export function estimateCostMicroUsd(usage: { inputTokens: number; outputTokens: number }, rates: Rates): number {
  const micro = usage.inputTokens * rates.inputPerMillionUsd + usage.outputTokens * rates.outputPerMillionUsd;
  return Math.ceil(Number(micro.toFixed(6)));
}
