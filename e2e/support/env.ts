import { readFileSync } from "node:fs";
import path from "node:path";

/** Reads one value from `.env.local` (Playwright does not load it for the test process; Next does for the server). */
export function readLocalEnv(name: string): string | undefined {
  try {
    const text = readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
    const match = new RegExp(`^${name}=(.*)$`, "m").exec(text);
    return match?.[1].trim().replace(/^["']|["']$/g, "") || undefined;
  } catch {
    return undefined;
  }
}
