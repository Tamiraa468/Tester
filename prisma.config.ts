import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI must use the direct (non-pooled) connection. Falls back to ""
    // instead of env() so commands that never connect (e.g. `prisma generate`
    // in postinstall) work without a .env file.
    url: process.env.DIRECT_URL ?? "",
  },
});
