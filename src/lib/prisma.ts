import { PrismaPg } from "@prisma/adapter-pg";
// Relative import (not "@/...") so standalone tsx scripts resolve it without path aliases.
import { PrismaClient } from "../generated/prisma/client";

// No "server-only" import: standalone scripts (seed, import) use this file outside Next.js.
export function createPrismaClient(
  connectionString: string | undefined = process.env.DATABASE_URL,
) {
  if (!connectionString) {
    throw new Error("Database connection string is not set (DATABASE_URL).");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
