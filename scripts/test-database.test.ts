import { describe, expect, it } from "vitest";
import { assertTestDatabaseUrl, maintenanceUrl, testDatabaseName } from "./test-database";

describe("assertTestDatabaseUrl", () => {
  it("accepts a database whose name ends with _test", () => {
    const url = "postgresql://postgres:postgres@localhost:5433/phd_prep_test";
    expect(assertTestDatabaseUrl(url)).toBe(url);
    expect(assertTestDatabaseUrl("postgres://u:p@h/x_test?schema=public")).toContain("x_test");
  });

  it("refuses the dev database and look-alikes", () => {
    for (const url of [
      "postgresql://postgres:postgres@localhost:5433/phd_prep",
      "postgresql://postgres:postgres@localhost:5433/phd_prep_test_copy",
      "postgresql://postgres:postgres@localhost:5433/test",
      "postgresql://postgres:postgres@localhost:5433/_test",
      "postgresql://postgres:postgres@localhost:5433/Phd_Test",
      "postgresql://postgres:postgres@localhost:5433/",
    ]) {
      expect(() => assertTestDatabaseUrl(url), url).toThrow(/_test/);
    }
  });

  it("refuses a missing, malformed or non-Postgres URL", () => {
    expect(() => assertTestDatabaseUrl(undefined)).toThrow(/TEST_DATABASE_URL is not set/);
    expect(() => assertTestDatabaseUrl("")).toThrow(/not set/);
    expect(() => assertTestDatabaseUrl("not a url")).toThrow(/valid URL/);
    expect(() => assertTestDatabaseUrl("mysql://h/x_test")).toThrow(/PostgreSQL/);
  });
});

describe("testDatabaseName / maintenanceUrl", () => {
  it("reads the name and swaps it for the maintenance database", () => {
    const url = "postgresql://postgres:postgres@localhost:5433/phd_prep_test";
    expect(testDatabaseName(url)).toBe("phd_prep_test");
    expect(maintenanceUrl(url)).toBe("postgresql://postgres:postgres@localhost:5433/postgres");
  });
});
