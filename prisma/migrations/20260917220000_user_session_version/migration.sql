-- Additive: integer session epoch for JWT revocation.
-- Existing users keep the same id; default 0 does not rewrite business rows.

ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
