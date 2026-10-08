-- CreateEnum
CREATE TYPE "DeclaredJourneyStep" AS ENUM ('CONTACT', 'RDV', 'DEVIS', 'SIGNATURE', 'ACOMPTE', 'DEVELOPPEMENT', 'MISE_EN_LIGNE', 'SOLDE', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "JourneyCursor" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "projectId" TEXT,
    "contextKey" TEXT NOT NULL,
    "step" "DeclaredJourneyStep" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "setById" TEXT,

    CONSTRAINT "JourneyCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JourneyCursorEvent" (
    "id" TEXT NOT NULL,
    "cursorId" TEXT,
    "companyId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "projectId" TEXT,
    "contextKey" TEXT NOT NULL,
    "fromStep" "DeclaredJourneyStep",
    "toStep" "DeclaredJourneyStep",
    "action" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT NOT NULL,

    CONSTRAINT "JourneyCursorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneyCursor_contextKey_key" ON "JourneyCursor"("contextKey");

-- CreateIndex
CREATE INDEX "JourneyCursor_companyId_idx" ON "JourneyCursor"("companyId");

-- CreateIndex
CREATE INDEX "JourneyCursorEvent_companyId_changedAt_idx" ON "JourneyCursorEvent"("companyId", "changedAt");

-- CreateIndex
CREATE INDEX "JourneyCursorEvent_contextKey_idx" ON "JourneyCursorEvent"("contextKey");

-- AddForeignKey
ALTER TABLE "JourneyCursor" ADD CONSTRAINT "JourneyCursor_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCursor" ADD CONSTRAINT "JourneyCursor_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCursor" ADD CONSTRAINT "JourneyCursor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Une opportunité supprimée retire le curseur qui ne porte que sur elle.
-- Un curseur de projet conserve la prestation livrée ; le lien d'opportunité passe à nul.
CREATE OR REPLACE FUNCTION "journey_cursor_on_opportunity_delete"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM "JourneyCursor"
  WHERE "opportunityId" = OLD."id" AND "projectId" IS NULL;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "JourneyCursor_opportunity_delete"
BEFORE DELETE ON "Opportunity"
FOR EACH ROW
EXECUTE FUNCTION "journey_cursor_on_opportunity_delete"();

-- AddForeignKey
ALTER TABLE "JourneyCursor" ADD CONSTRAINT "JourneyCursor_setById_fkey" FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCursorEvent" ADD CONSTRAINT "JourneyCursorEvent_cursorId_fkey" FOREIGN KEY ("cursorId") REFERENCES "JourneyCursor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCursorEvent" ADD CONSTRAINT "JourneyCursorEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JourneyCursorEvent" ADD CONSTRAINT "JourneyCursorEvent_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
