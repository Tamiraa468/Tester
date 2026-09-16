import { defineConfig } from "vitest/config";

// The import pipeline is plain Node code, so no jsdom / React plugins are needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
    alias: { "@/": new URL("./src/", import.meta.url).pathname },
  },
});
