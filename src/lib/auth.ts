import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

/**
 * Returns the DB user for the signed-in Clerk user, creating it on first use.
 * Returns null when signed out. Cached so it runs once per request.
 */
export const getOrCreateDbUser = cache(async () => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  // Only hit the Clerk API when the user row has to be created.
  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const name =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
    clerkUser?.username ||
    null;

  // Upsert (not create) so concurrent first requests don't collide on clerkId.
  return db.user.upsert({
    where: { clerkId: userId },
    update: {},
    create: { clerkId: userId, email, name },
  });
});

export async function requireUser() {
  // Signed-out page requests redirect to sign-in with redirect_url back to the
  // requested page; server actions get 401; other requests get 404.
  await auth.protect();
  const user = await getOrCreateDbUser();
  // Unreachable after auth.protect(); narrows the type to a non-null user.
  if (!user) redirect("/sign-in");
  return user;
}

export async function isAdmin() {
  const { sessionClaims } = await auth();
  return sessionClaims?.metadata?.role === "admin";
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin())) redirect("/dashboard");
  return user;
}
