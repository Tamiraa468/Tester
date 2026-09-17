import { config } from "dotenv";
import { assertTestDatabaseUrl } from "./test-database";

/**
 * Reads TEST_DATABASE_URL from the environment or .env without loading anything else
 * from .env into process.env, so DATABASE_URL / DIRECT_URL can never leak in.
 */
export function readTestDatabaseUrl(): string {
  const fromFile: Record<string, string> = {};
  config({ processEnv: fromFile, quiet: true });
  return assertTestDatabaseUrl(process.env.TEST_DATABASE_URL ?? fromFile.TEST_DATABASE_URL);
}
