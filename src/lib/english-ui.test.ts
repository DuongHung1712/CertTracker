import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Guard for the English-first interface (spec 6.4): no Vietnamese letters in
// shipped source. Tests, generated DB types and import fixtures are exempt
// because they must keep legacy Vietnamese data to prove the import still
// accepts it.

const SRC = join(process.cwd(), "src");
const VIETNAMESE = /[À-ỹĐđ]/u;

// Path prefixes (posix, relative to the repo root) of areas not yet switched
// to English. Each area removes its prefixes in its own commit; the final area
// leaves the list empty and deletes this constant.
const PENDING_AREAS: string[] = [
  // (e) /design page and the final sweep
  "src/app/(dev)",
];

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

const isPending = (file: string) =>
  PENDING_AREAS.some((prefix) => file.startsWith(`${prefix}/`) || file === prefix);

describe("English-first interface", () => {
  it("has no Vietnamese letters in converted source files", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles) {
      if (isPending(file)) continue;
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

  it("keeps PENDING_AREAS free of stale entries", () => {
    const stale = PENDING_AREAS.filter(
      (prefix) =>
        !sourceFiles.some(
          (file) => file.startsWith(`${prefix}/`) || file === prefix,
        ),
    );
    expect(stale).toEqual([]);
  });
});
