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

// Signed-in user for server actions; see signInAs() in ./session. The session claims
// carry the role the same way the real token does, so requireAdmin() can be exercised.
vi.mock("@clerk/nextjs/server", () => {
  type Session = { userId: string | null; admin: boolean };
  const session = (): Session =>
    (globalThis as { __testClerkSession?: Session }).__testClerkSession ?? {
      userId: null,
      admin: false,
    };
  const claims = () => (session().admin ? { metadata: { role: "admin" } } : { metadata: {} });
  const auth = Object.assign(
    async () => ({ userId: session().userId, sessionClaims: claims() }),
    {
      protect: async () => {
        const { userId } = session();
        if (!userId) throw new Error("UNAUTHENTICATED");
        return { userId };
      },
    },
  );
  return { auth, currentUser: async () => null };
});
