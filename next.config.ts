import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "leaflet"],
};

export default nextConfig;
