import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Parses dotenv-style text: `KEY=value`, an optional `export ` prefix, spaces around `=`, quoted values (a `#`
 * inside quotes is kept), a trailing ` # comment` after an unquoted value, CRLF line ends. Later lines win.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, rest] = match;
    const quoted = /^(["'])(.*?)\1/.exec(rest);
    values[key] = quoted ? quoted[2] : rest.replace(/\s+#.*$/, "").trim();
  }
  return values;
}

/** Reads and parses one env file; a missing file is an empty result. */
export function readEnvFile(file: string): Record<string, string> {
  return existsSync(file) ? parseEnvFile(readFileSync(file, "utf8")) : {};
}

/**
 * One value, from the process environment first, then from `.env.local` (Playwright does not load it for the test
 * process; Next does for the server). Empty means unset.
 */
export function readLocalEnv(name: string): string | undefined {
  return process.env[name] || readEnvFile(path.resolve(process.cwd(), ".env.local"))[name] || undefined;
}
