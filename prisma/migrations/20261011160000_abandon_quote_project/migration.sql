-- Clôture sans encaissement : devis et projets abandonnés restent en historique.
-- Les totaux « prévisionnel actif » ne comptent que les devis ACCEPTED.
--
-- Sûr sur une base déjà peuplée :
-- - ADD VALUE IF NOT EXISTS : additif, aucune ligne modifiée
-- - colonnes nullable sans DEFAULT destructif : NULL sur les lignes existantes
-- - aucune DELETE / UPDATE de Quote, Project, Payment

ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "abandonReason" TEXT;

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "abandonedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "abandonReason" TEXT;
