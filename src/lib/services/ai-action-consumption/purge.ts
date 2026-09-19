import "server-only";

/** Keep rows for this long after `expiresAt` so the anti-replay window stays intact. */
export const AI_ACTION_CONSUMPTION_PURGE_RETENTION_MS = 24 * 60 * 60 * 1000;

export type AiActionConsumptionRetention = {
  ms: number;
};

export type AiActionConsumptionPurgeStore = {
  aiActionConsumption: {
    deleteMany: (args: {
      where: { expiresAt: { lt: Date } };
    }) => Promise<{ count: number }>;
  };
};

/**
 * Opportunistic cleanup: delete rows whose anti-replay window has been expired
 * for at least `retention` (`expiresAt < now - retention`).
 *
 * Pass a Prisma client or transaction as `db`. When omitted, the server Prisma
 * singleton is loaded lazily so claim tests do not open a database.
 */
export async function purgeExpiredAiActionConsumptions(
  now: Date,
  retention: AiActionConsumptionRetention,
  db?: AiActionConsumptionPurgeStore,
): Promise<{ count: number }> {
  const cutoff = new Date(now.getTime() - retention.ms);
  const store = db ?? (await import("@/lib/db/prisma")).prisma;
  return store.aiActionConsumption.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
}
