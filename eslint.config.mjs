import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import clerkNext from "@clerk/eslint-plugin/next";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Resource-level auth: protected resources must start with `await auth.protect()`.
  // The rule is experimental, so @clerk/eslint-plugin is pinned to an exact version.
  {
    plugins: { "@clerk/next": clerkNext },
    rules: {
      "@clerk/next/require-auth-protection": [
        "error",
        {
          protected: [
            "src/app/(app)/**",
            "src/app/api/**",
            "src/server/actions/**",
          ],
          public: ["src/app/api/health/**"],
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
    // Prisma generated client.
    "src/generated/**",
  ]),
]);

export default eslintConfig;
