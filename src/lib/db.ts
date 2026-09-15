import "server-only";
import { createPrismaClient } from "./prisma";

type PrismaClient = ReturnType<typeof createPrismaClient>;

// Reuse one client across hot reloads in development to avoid exhausting connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
