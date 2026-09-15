import { clerkMiddleware } from "@clerk/nextjs/server";

// No auth or role checks here: every page, layout, route handler and server
// action protects itself (see src/lib/auth.ts and the
// @clerk/next/require-auth-protection ESLint rule).
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk frontend API proxy
    "/__clerk/(.*)",
  ],
};
