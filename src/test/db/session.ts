import { expect } from "vitest";

/** Signs the mocked Clerk session in as this Clerk user id (null: signed out). */
export function signInAs(clerkId: string | null): void {
  (globalThis as { __testClerkUserId?: string | null }).__testClerkUserId = clerkId;
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
