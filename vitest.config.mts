import { configDefaults, defineConfig } from "vitest/config";

// The import pipeline is plain Node code, so no jsdom / React plugins are needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    // The database suite runs separately: `pnpm test:db` (vitest.db.config.mts).
    exclude: [...configDefaults.exclude, "**/*.db.test.ts"],
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
    coverage: {
      provider: "v8",
      // The quiz core is the part that must stay covered; it decides scores and shuffling.
      include: ["src/lib/quiz/**"],
      exclude: ["src/lib/quiz/**/*.test.ts"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
