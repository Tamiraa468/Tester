// Runs in every database-suite worker before the test files.
import { vi } from "vitest";
import { assertTestDatabaseUrl } from "../../../scripts/test-database";

// Second line of defence: the app's db client reads DATABASE_URL.
assertTestDatabaseUrl(process.env.DATABASE_URL);
if (process.env.DIRECT_URL !== process.env.DATABASE_URL) {
  throw new Error("DIRECT_URL must point at the test database.");
}

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${url}`), { redirectUrl: url });
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

// Signed-in user for server actions; see signInAs() in ./session.
vi.mock("@clerk/nextjs/server", () => {
  const current = () => (globalThis as { __testClerkUserId?: string | null }).__testClerkUserId ?? null;
  const auth = Object.assign(async () => ({ userId: current(), sessionClaims: {} }), {
    protect: async () => {
      if (!current()) throw new Error("UNAUTHENTICATED");
      return { userId: current() };
    },
  });
  return { auth, currentUser: async () => null };
});
