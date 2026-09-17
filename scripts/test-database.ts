// Guards for the database test suite. It must only ever touch a dedicated database
// whose name ends in "_test", read from TEST_DATABASE_URL, never DATABASE_URL/DIRECT_URL.

const NAME = /^[a-z0-9_]+_test$/;

/** Returns the URL if it points at a "*_test" database; throws otherwise. */
export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Add it to .env (see .env.example), then run `pnpm test:db:setup`.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must be a PostgreSQL URL.");
  }
  const name = testDatabaseName(parsed);
  if (!NAME.test(name)) {
    throw new Error(
      `Refusing to use database "${name}": the test database name must end with "_test".`,
    );
  }
  return url;
}

export function testDatabaseName(url: URL | string): string {
  const parsed = typeof url === "string" ? new URL(url) : url;
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}

/** The same server, connected to the maintenance database (to create the test one). */
export function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = "/postgres";
  return parsed.toString();
}
