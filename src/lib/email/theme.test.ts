import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EMAIL_THEME } from "@/lib/email/theme";

function readRootTokens(): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
  const root = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
  return Object.fromEntries([...root.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}

const tokens = readRootTokens();

const TOKEN_OF: Record<keyof typeof EMAIL_THEME, string> = {
  background: "background",
  card: "card",
  foreground: "foreground",
  mutedForeground: "muted-foreground",
  primary: "primary",
  primaryForeground: "primary-foreground",
  border: "border",
  expiringSoonFg: "status-expiring-soon-fg",
  expiringSoonBg: "status-expiring-soon-bg",
  expiring60Fg: "status-expiring-60-fg",
  expiring60Bg: "status-expiring-60-bg",
  expiredFg: "status-expired-fg",
  expiredBg: "status-expired-bg",
};

describe("EMAIL_THEME", () => {
  it.each(Object.entries(TOKEN_OF))("%s matches --%s in globals.css :root", (key, token) => {
    const value = tokens[token];
    expect(value, `--${token} missing from :root`).toBeDefined();
    expect(EMAIL_THEME[key as keyof typeof EMAIL_THEME].toLowerCase()).toBe(value?.toLowerCase());
  });
});
