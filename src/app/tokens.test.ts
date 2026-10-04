import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/design/contrast";

function readRootTokens(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
}

const tokens = readRootTokens();

function hex(name: string): string {
  const value = tokens[name];
  if (!value) throw new Error(`Token --${name} is missing or not #rrggbb in :root`);
  return value;
}

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

// Expiry-chart bars are graphic objects drawn straight on the card (WCAG 1.4.11).
const CHART_STATUS_IDS = ["active", "expiring-60", "expiring-soon", "expired", "no-expiry"];

describe("design tokens", () => {
  it.each(TEXT_PAIRS)("text --%s on --%s reaches 4.5:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)("control --%s on --%s reaches 3:1", (fg, bg) => {
    expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(3);
  });

  it.each(CHART_STATUS_IDS)("chart bar --status-%s-fg on --card reaches 3:1", (id) => {
    expect(contrastRatio(hex(`status-${id}-fg`), hex("card"))).toBeGreaterThanOrEqual(3);
  });
});
