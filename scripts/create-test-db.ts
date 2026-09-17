// Creates the database for `pnpm test:db` (e.g. phd_prep_test) on the same server if it
// does not exist yet. Migrations are applied by the test run itself.
import { createPrismaClient } from "../src/lib/prisma";
import { maintenanceUrl, testDatabaseName } from "./test-database";
import { readTestDatabaseUrl } from "./test-env";

async function main() {
  const url = readTestDatabaseUrl();
  const name = testDatabaseName(url);
  const client = createPrismaClient(maintenanceUrl(url));
  try {
    const existing = await client.$queryRaw<{ found: number }[]>`
      SELECT 1 AS found FROM pg_database WHERE datname = ${name}`;
    if (existing.length > 0) {
      console.log(`Test database "${name}" already exists.`);
      return;
    }
    // The name matched /^[a-z0-9_]+_test$/ (assertTestDatabaseUrl), so quoting is enough.
    await client.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    console.log(`Created test database "${name}".`);
  } finally {
    await client.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
