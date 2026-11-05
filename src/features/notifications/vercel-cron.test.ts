import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const config = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
  crons?: { path: string; schedule: string }[];
};

const REEXPORTED_UNSAFE_METHOD = /export\s*\{[^}]*\b(POST|PUT|PATCH|DELETE)\b[^}]*\}/;

describe("vercel.json crons", () => {
  it("schedules exactly the two jobs from the design (spec 6.5), in UTC", () => {
    expect(config.crons).toEqual([
      { path: "/api/cron/expiry-alerts", schedule: "0 1 * * 1" },
      { path: "/api/cron/monthly-report", schedule: "0 1 1 * *" },
    ]);
  });

  it.each(config.crons ?? [])("$path has a route file that only exports GET", ({ path }) => {
    const name = path.replace("/api/cron/", "");
    const file = join(root, "src", "app", "api", "cron", name, "route.ts");
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toMatch(/export (async )?function GET\b/);
    expect(source).not.toMatch(/export (async )?function (POST|PUT|PATCH|DELETE)\b/);
    expect(source).not.toMatch(/export const (POST|PUT|PATCH|DELETE)\b/);
    // Re-exports such as `export { handler as POST }` or `export { POST } from "..."`.
    expect(source).not.toMatch(REEXPORTED_UNSAFE_METHOD);
  });

  it("the re-export check catches the aliased forms", () => {
    expect("export { handler as POST };").toMatch(REEXPORTED_UNSAFE_METHOD);
    expect('export { GET, DELETE } from "./x";').toMatch(REEXPORTED_UNSAFE_METHOD);
    expect("export { handler as GET };").not.toMatch(REEXPORTED_UNSAFE_METHOD);
  });
});
