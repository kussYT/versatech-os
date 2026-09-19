import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  // POST /api/ai/chat uses Node: `export const runtime = "nodejs"`.
  // Do not add /api/ai to isPublicPath(). Do not mount @mastra/next catch-all.
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "leaflet",
    "@mastra/*",
  ],
};

export default nextConfig;
