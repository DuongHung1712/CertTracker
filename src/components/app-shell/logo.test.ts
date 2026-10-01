import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("CertTracker Logo & Favicon Assets", () => {
  const rootDir = process.cwd();

  it("has valid src/app/icon.svg with design tokens", () => {
    const content = readFileSync(join(rootDir, "src/app/icon.svg"), "utf-8");
    expect(content).toContain("<svg");
    expect(content).toContain('viewBox="0 0 32 32"');
    // Check brand tokens
    expect(content).toContain("#0E5C58"); // Primary teal
    expect(content).toContain("#E2EFEC"); // Accent mint
    expect(content).toContain("#FFFFFF"); // Card white
  });

  it("has public/logo.svg with wordmark", () => {
    const content = readFileSync(join(rootDir, "public/logo.svg"), "utf-8");
    expect(content).toContain("<svg");
    expect(content).toContain("Cert");
    expect(content).toContain("Tracker");
    expect(content).toContain("#0E5C58");
    expect(content).toContain("#15212B");
  });

  it("has updated src/app/favicon.ico (not default Vercel 25KB icon)", () => {
    const appIco = readFileSync(join(rootDir, "src/app/favicon.ico"));
    // Default Vercel icon was exactly 25931 bytes
    expect(appIco.length).not.toBe(25931);
    expect(appIco.length).toBeGreaterThan(10000);
  });
});
