// Node resolve hook for scripts/make-import-file.ts: maps the app's "@/" alias to src/ and adds the ".ts" that the app's imports leave out.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, nextResolve) {
  const target = specifier.startsWith("@/")
    ? new URL(specifier.slice(2), SRC)
    : specifier.startsWith(".") && context.parentURL
      ? new URL(specifier, context.parentURL)
      : null;
  if (!target) return nextResolve(specifier, context);
  const withExtension = EXTENSIONS.map((extension) => target.href + extension).find((href) => existsSync(fileURLToPath(href)));
  return nextResolve(withExtension ?? target.href, context);
}
