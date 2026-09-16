-- Additive: hashed credentials for internal login (H11).
-- Nullable so existing users remain valid until a hash is set (seed / ops).

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
