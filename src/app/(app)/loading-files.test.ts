import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = __dirname;

/** Every directory under (app) that holds a page.tsx, relative to (app). */
function routesWithPage(dir = APP_DIR, prefix = ""): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    const rel = prefix ? `${prefix}/${name}` : name;
    if (readdirSync(full).includes("page.tsx")) found.push(rel);
    found.push(...routesWithPage(full, rel));
  }
  return found;
}

describe("loading skeletons", () => {
  const routes = routesWithPage();

  it("finds the app routes (guards against the walk silently matching nothing)", () => {
    expect(routes).toEqual(
      expect.arrayContaining(["dashboard", "courses", "import", "import/[batchId]", "me", "members", "org", "profile", "records", "settings"]),
    );
  });

  it.each(routes)("%s has a loading.tsx that announces itself as busy", (route) => {
    const file = join(APP_DIR, route, "loading.tsx");
    const source = readFileSync(file, "utf8");
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy="true"');
    expect(source).toMatch(/aria-label="Loading [a-z ]+"/);
  });
});
