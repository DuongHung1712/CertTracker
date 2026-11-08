import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

function readTokens(selector: string): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const regex = new RegExp(`${selector}\\s*\\{([^}]*)\\}`);
  const block = regex.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

const tokens = readTokens(":root");
const darkTokens = readTokens("\\.dark");

function hex(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Token --${name} is missing or not #rrggbb in :root`);
  return value;
}

function darkHex(name: string): string {
  const value = darkTokens[name];
  if (!value) throw new Error(`Token --${name} is missing or not #rrggbb in .dark`);
  return value;
}

/** `fg` painted at `alpha` over `bg`: what Tailwind's `bg-primary/10` shows. */
function over(fg: string, bg: string, alpha: number): string {
  const channels = (hexValue: string) => [1, 3, 5].map((i) => Number.parseInt(hexValue.slice(i, i + 2), 16));
  const [f, b] = [channels(fg), channels(bg)];
  return `#${f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

// The selected Explorer row is `bg-primary/10` on the card, the focus ring is offset on the card (master-list.tsx).
const SELECTED_ROW_ALPHA = 0.1;

const STATUS_IDS = ["active", "expiring-60", "expiring-soon", "expired", "no-expiry", "na"];

// Text must reach 4.5:1 (WCAG 1.4.3).
const TEXT_PAIRS: Array<[string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["secondary-foreground", "secondary"],
  ["primary-foreground", "primary"],
  ["primary-foreground-muted", "primary"],
  ["primary-foreground", "primary-hover"],
  ["primary", "background"],
  ["primary", "card"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ...STATUS_IDS.map((id): [string, string] => [`status-${id}-fg`, `status-${id}-bg`]),
];

// Control boundaries and focus indicators must reach 3:1 (WCAG 1.4.11).
const UI_PAIRS: Array<[string, string]> = [
  ["input", "card"],
  ["input", "background"],
  ["ring", "background"],
  ["ring", "card"],
];

const DARK_UI_PAIRS: Array<[string, string]> = [
  ...UI_PAIRS,
  ["input", "muted"],
];

// Expiry-chart bars are graphic objects drawn straight on the card (WCAG 1.4.11).
const CHART_STATUS_IDS = ["active", "expiring-60", "expiring-soon", "expired", "no-expiry"];
const CHART_TOKEN_IDS = ["chart-1", "chart-2", "chart-3"];

describe("design tokens", () => {
  it.each(TEXT_PAIRS)("text --%s on --%s reaches 4.5:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("control --%s on --%s reaches 3:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });

  it("focus ring reaches 3:1 on the selected and on the unselected Explorer row", () => {
    const selected = over(hex("primary"), hex("card"), SELECTED_ROW_ALPHA);
    expect(contrastRatio(hex("ring"), selected)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex("ring"), hex("card"))).toBeGreaterThanOrEqual(3);
  });

  it("row text reaches 4.5:1 on the selected Explorer row", () => {
    const selected = over(hex("primary"), hex("card"), SELECTED_ROW_ALPHA);
    expect(contrastRatio(hex("foreground"), selected)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex("muted-foreground"), selected)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CHART_STATUS_IDS)("chart bar --status-%s-fg on --card reaches 3:1", (id) => {
    expect(contrastRatio(hex(`status-${id}-fg`), hex("card"))).toBeGreaterThanOrEqual(3);
  });

  it.each(CHART_TOKEN_IDS)("chart token --%s on --card reaches 3:1", (id) => {
    expect(contrastRatio(hex(id), hex("card"))).toBeGreaterThanOrEqual(3);
  });
});

describe("dark design tokens", () => {
  it.each(TEXT_PAIRS)("dark text --%s on --%s reaches 4.5:1", (fg, bg) => {
    expect(contrastRatio(darkHex(fg), darkHex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(DARK_UI_PAIRS)("dark control --%s on --%s reaches 3:1", (fg, bg) => {
    expect(contrastRatio(darkHex(fg), darkHex(bg))).toBeGreaterThanOrEqual(3);
  });

  it("dark focus ring reaches 3:1 on the selected and on the unselected Explorer row", () => {
    const selected = over(darkHex("primary"), darkHex("card"), SELECTED_ROW_ALPHA);
    expect(contrastRatio(darkHex("ring"), selected)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkHex("ring"), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });

  it("dark row text reaches 4.5:1 on the selected Explorer row", () => {
    const selected = over(darkHex("primary"), darkHex("card"), SELECTED_ROW_ALPHA);
    expect(contrastRatio(darkHex("foreground"), selected)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkHex("muted-foreground"), selected)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CHART_STATUS_IDS)("dark chart bar --status-%s-fg on --card reaches 3:1", (id) => {
    expect(contrastRatio(darkHex(`status-${id}-fg`), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });

  it.each(CHART_TOKEN_IDS)("dark chart token --%s on --card reaches 3:1", (id) => {
    expect(contrastRatio(darkHex(id), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });
});
