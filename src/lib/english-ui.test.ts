import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Guard for the English-first interface (spec 6.4): no Vietnamese letters in
// shipped source. Tests, generated DB types and import fixtures are exempt
// because they must keep legacy Vietnamese data to prove the import still
// accepts it.

const SRC = join(process.cwd(), "src");
const VIETNAMESE = /[À-ỹĐđ]/u;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function toRepoPath(file: string): string {
  return relative(process.cwd(), file).split(sep).join("/");
}

const sourceFiles = walk(SRC)
  .map(toRepoPath)
  .filter((file) => /\.tsx?$/.test(file))
  .filter((file) => !/\.test\.tsx?$/.test(file))
  .filter((file) => file !== "src/types/database.ts")
  .filter((file) => !file.startsWith("src/features/import/__fixtures__/"));

describe("English-first interface", () => {
  it("has no Vietnamese letters in shipped source files", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (VIETNAMESE.test(line)) {
            offenders.push(`${file}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
