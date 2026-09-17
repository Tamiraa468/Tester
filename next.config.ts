import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The admin import posts the file itself to a Server Action, and the default cap
      // is 1 MB. Vercel's functions accept at most 4.5 MB of request body, so uploads
      // are capped at 4 MB (see import.schemas.ts) and this leaves room for the
      // multipart overhead on top of the file.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
