import { config } from "dotenv";
import { configDefaults, defineConfig } from "vitest/config";

// Database suite (`pnpm test:db`). Runs ONLY against TEST_DATABASE_URL, a dedicated
// "*_test" database; never against DATABASE_URL or DIRECT_URL. Only TEST_DATABASE_URL is
// read from .env (into a separate object), and both app variables are overwritten with
// it, so the app's db client and the Prisma CLI can only reach the test database.
// The "_test" name check runs in the global setup (before migrations) and in every worker.
const fromFile: Record<string, string> = {};
config({ processEnv: fromFile, quiet: true });
const url = process.env.TEST_DATABASE_URL ?? fromFile.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Add it to .env (see .env.example), then run `pnpm test:db:setup`.",
  );
}
process.env.TEST_DATABASE_URL = url;
process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: [...configDefaults.exclude],
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
    env: { DATABASE_URL: url, DIRECT_URL: url, TEST_DATABASE_URL: url },
    globalSetup: ["./src/test/db/global-setup.ts"],
    setupFiles: ["./src/test/db/setup.ts"],
    // One shared database: files run one after another.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
