import { ClerkProvider } from "@clerk/nextjs";
import { mnMN } from "@clerk/localizations/mn-MN";

/**
 * Clerk only where it is needed: the signed-in app and the two sign-in pages.
 *
 * It is deliberately NOT in the root layout. ClerkProvider boots clerk-js, which talks
 * to Clerk's own domain and gets Cloudflare cookies set on it — third-party cookies on
 * a page that has nothing to sign in. Keeping it off the landing page and the 404 makes
 * those pages load no cross-origin script at all.
 *
 * This changes nothing about protection: every page, layout, route handler and server
 * action still calls requireUser() / requireAdmin() for itself.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <ClerkProvider localization={mnMN}>{children}</ClerkProvider>;
}
