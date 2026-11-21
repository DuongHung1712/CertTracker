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

  // Explorer selected row (master-list.tsx): solid `bg-primary` row, focus ring offset by a `card` gap.
  it("Explorer selected row: text, subtitle, focus ring and row edge reach contrast", () => {
    expect(contrastRatio(hex("primary-foreground"), hex("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex("primary-foreground-muted"), hex("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hex("ring"), hex("card"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex("primary"), hex("card"))).toBeGreaterThanOrEqual(3);
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

  it("dark Explorer selected row: text, subtitle, focus ring and row edge reach contrast", () => {
    expect(contrastRatio(darkHex("primary-foreground"), darkHex("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkHex("primary-foreground-muted"), darkHex("primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkHex("ring"), darkHex("card"))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(darkHex("primary"), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });

  it.each(CHART_STATUS_IDS)("dark chart bar --status-%s-fg on --card reaches 3:1", (id) => {
    expect(contrastRatio(darkHex(`status-${id}-fg`), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });

  it.each(CHART_TOKEN_IDS)("dark chart token --%s on --card reaches 3:1", (id) => {
    expect(contrastRatio(darkHex(id), darkHex("card"))).toBeGreaterThanOrEqual(3);
  });
});

// Credential Vault (data-style="vault") overrides surfaces and the input border; text colours come from :root / .dark.
describe("Credential Vault tokens", () => {
  const vault = readTokens(String.raw`html\[data-style="vault"\]`);
  const vaultDark = readTokens(String.raw`html\[data-style="vault"\]\.dark`);
  const modes = [
    { name: "light", own: vault, base: tokens, inputBg: vault.card },
    { name: "dark", own: vaultDark, base: darkTokens, inputBg: "#0E161C" },
  ];

  it.each(modes)("$name: body text reaches 4.5:1 on the vault surfaces", ({ own, base }) => {
    for (const surface of ["background", "card"]) {
      expect(contrastRatio(base.foreground, own[surface])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(base["muted-foreground"], own[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(modes)("$name: the input border reaches 3:1 against the page, the card and the field", ({ own, inputBg }) => {
    for (const surface of [own.background, own.card, inputBg]) {
      expect(contrastRatio(own.input, surface)).toBeGreaterThanOrEqual(3);
    }
  });
});

// Nordic Heritage (data-style="nordic") provides warm linen & terracotta styling.
describe("Nordic Heritage tokens", () => {
  const nordic = readTokens(String.raw`html\[data-style="nordic"\]`);
  const nordicDark = readTokens(String.raw`html\[data-style="nordic"\]\.dark`);
  const modes = [
    { name: "light", own: nordic, base: tokens, inputBg: nordic.card },
    { name: "dark", own: nordicDark, base: darkTokens, inputBg: "#151815" },
  ];

  it.each(modes)("$name: body text reaches 4.5:1 on the nordic surfaces", ({ own }) => {
    for (const surface of ["background", "card"]) {
      expect(contrastRatio(own.foreground, own[surface])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(own["muted-foreground"], own[surface])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(modes)("$name: the input border reaches 3:1 against the page, the card and the field", ({ own, inputBg }) => {
    for (const surface of [own.background, own.card, inputBg]) {
      expect(contrastRatio(own.input, surface)).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(modes)("$name: primary and ring reach contrast guidelines on card and background", ({ own }) => {
    expect(contrastRatio(own["primary-foreground"], own.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(own.primary, own.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(own.primary, own.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(own.ring, own.card)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(own.ring, own.background)).toBeGreaterThanOrEqual(3);
  });

  it.each(modes)("$name: sidebar and secondary surfaces reach WCAG AA contrast", ({ own }) => {
    expect(contrastRatio(own["sidebar-foreground"], own.sidebar)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(own["secondary-foreground"], own.secondary)).toBeGreaterThanOrEqual(4.5);
  });
});
