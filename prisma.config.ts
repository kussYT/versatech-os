import "dotenv/config";
import { defineConfig } from "prisma/config";

/** Must match `.env.example`. Used only when DATABASE_URL is unset so CLI validate/generate can run without a live database. */
const ILLUSTRATIVE_DATABASE_URL =
  "postgresql://USER:PASSWORD@HOST:5432/versatech_os";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL?.trim() || ILLUSTRATIVE_DATABASE_URL,
  },
});
