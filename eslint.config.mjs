import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `cn` from "@/lib/utils" (src/lib/utils.ts) is `createCn`-configured
      // to understand the design-system text sizes (text-caption, etc.);
      // `shadcn add` regenerates files importing plain "cn", which silently
      // drops those classes next to a colour class. "cn/config" (used to
      // build the wrapper) stays allowed.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "cn",
              message: 'Import cn from "@/lib/utils" instead (it knows the design-system text sizes).',
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
