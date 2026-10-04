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
          patterns: [
            {
              group: ["@/lib/supabase/admin", "**/lib/supabase/admin", "**/supabase/admin"],
              message: "The service-role client is for the cron route handlers only (docs/decisions.md #35).",
            },
          ],
        },
      ],
    },
  },
  // Flat config: the last matching config wins, so this override repeats the `cn` path restriction and
  // simply omits the admin-client pattern, which is what lets the cron handlers import it.
  {
    files: ["src/app/api/cron/**/route.ts"],
    rules: {
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
