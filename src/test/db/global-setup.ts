import { execFileSync } from "node:child_process";
import { assertTestDatabaseUrl, testDatabaseName } from "../../../scripts/test-database";
import { createPrismaClient } from "../../lib/prisma";

const TABLES = [
  "QuestionReport",
  "Bookmark",
  "QuestionProgress",
  "AttemptItem",
  "Attempt",
  "ExamPreset",
  "Option",
  "Question",
  "Subject",
  "User",
] as const;

type Client = ReturnType<typeof createPrismaClient>;

async function withClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const client = createPrismaClient(url);
  try {
    return await run(client);
  } finally {
    await client.$disconnect();
  }
}

async function countRows(client: Client): Promise<string[]> {
  const found: string[] = [];
  for (const table of TABLES) {
    // Table names come from the constant above, never from input.
    const [{ count }] = await client.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*) AS count FROM "${table}"`,
    );
    if (count > BigInt(0)) found.push(`${table}=${count}`);
  }
  return found;
}

/**
 * Applies migrations to the test database, clears what a crashed run may have left,
 * and after the run fails loudly if any test did not clean up its own data.
 */
export default async function setup() {
  const url = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  const name = testDatabaseName(url);
  if (process.env.DATABASE_URL !== url || process.env.DIRECT_URL !== url) {
    throw new Error("DATABASE_URL and DIRECT_URL must point at the test database.");
  }

  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });

  await withClient(url, async (client) => {
    const [{ current }] = await client.$queryRaw<{ current: string }[]>`
      SELECT current_database() AS current`;
    if (current !== name) throw new Error("Connected to the wrong database.");
    const leftovers = await countRows(client);
    if (leftovers.length > 0) {
      console.warn(`[test:db] clearing rows left by an earlier run: ${leftovers.join(", ")}`);
      await client.$executeRawUnsafe(
        `TRUNCATE ${TABLES.map((table) => `"${table}"`).join(", ")} CASCADE`,
      );
    }
  });

  return async () => {
    const leftovers = await withClient(url, countRows);
    if (leftovers.length > 0) {
      throw new Error(`[test:db] tests left data behind: ${leftovers.join(", ")}`);
    }
  };
}
