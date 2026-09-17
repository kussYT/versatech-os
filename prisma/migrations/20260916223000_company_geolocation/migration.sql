-- Additive: persist geocoded / manual coordinates on Company for the prospect map.
-- Nullable so existing rows stay valid until an operator geocodes or enters lat/lng.

CREATE TYPE "GeocodeStatus" AS ENUM ('OK', 'FAILED', 'MANUAL');

ALTER TABLE "Company" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN "geocodedAddress" TEXT;
ALTER TABLE "Company" ADD COLUMN "geocodedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "geocodeStatus" "GeocodeStatus";
