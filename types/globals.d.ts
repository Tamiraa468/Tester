export {};

declare global {
  // Requires the Clerk session token to include
  // { "metadata": "{{user.public_metadata}}" } (Dashboard -> Sessions).
  interface CustomJwtSessionClaims {
    metadata: {
      role?: "admin";
    };
  }
}
