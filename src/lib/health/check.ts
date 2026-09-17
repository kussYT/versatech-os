import "server-only";

import { prisma } from "@/lib/db/prisma";
import { logServerError } from "@/lib/observability/log-error";

export async function isDatabaseReachable() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logServerError("health.db", error);
    return false;
  }
}
