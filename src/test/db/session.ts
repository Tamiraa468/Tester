import { expect } from "vitest";

type Session = { userId: string | null; admin: boolean };

/**
 * Signs the mocked Clerk session in as this Clerk user id (null: signed out).
 * `admin` puts { role: "admin" } in the session claims, the way the real token does
 * once the Clerk Dashboard is configured; without it requireAdmin() redirects.
 */
export function signInAs(clerkId: string | null, { admin = false } = {}): void {
  (globalThis as { __testClerkSession?: Session }).__testClerkSession = {
    userId: clerkId,
    admin: clerkId === null ? false : admin,
  };
}

/** Awaits an action that should redirect and returns the target URL. */
export async function expectRedirect(action: Promise<unknown>): Promise<string> {
  try {
    const result = await action;
    throw new Error(`Expected a redirect, got ${JSON.stringify(result)}`);
  } catch (error) {
    const url = (error as { redirectUrl?: string }).redirectUrl;
    if (!url) throw error;
    return url;
  }
}

/** The id at the end of a redirect such as /exam/<id> or /practice/<id>. */
export async function redirectedId(action: Promise<unknown>, prefix: string): Promise<string> {
  const url = await expectRedirect(action);
  const match = new RegExp(`^${prefix}/([^/?]+)$`).exec(url);
  expect(match, url).not.toBeNull();
  return match![1];
}
