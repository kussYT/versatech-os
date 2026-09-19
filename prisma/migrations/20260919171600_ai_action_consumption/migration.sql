-- Additive: technical AI confirmation anti-replay. No métier tables touched.
-- CREATE TABLE + UNIQUE(actionId) only. No DROP. No User FK.

CREATE TABLE "AiActionConsumption" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiActionConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiActionConsumption_actionId_key" ON "AiActionConsumption"("actionId");

-- Optional cleanup index: purge uses expiresAt < now - retention.
CREATE INDEX "AiActionConsumption_expiresAt_idx" ON "AiActionConsumption"("expiresAt");
