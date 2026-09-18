import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PROTECTED_COMPANY_ID, PROTECTED_USER_ID } from "../src/lib/db/demo-cleanup-guard";
import { getDatabaseUrl } from "../src/lib/db/env";
import { assertGeocodeMissingAllowed } from "../src/lib/db/geocode-missing-guard";
import {
  fetchNominatimHit,
  isNominatimConfigured,
  planCompanyGeocode,
} from "../src/lib/prospection/geocode";

const NOMINATIM_GAP_MS = 1_100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertGeocodeMissingAllowed();

  if (!isNominatimConfigured()) {
    throw new Error(
      "NOMINATIM_USER_AGENT is required. Set it in .env (identifiable contact) then retry. No coordinates will be invented.",
    );
  }

  const userAgent = process.env.NOMINATIM_USER_AGENT!.trim();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  try {
    const actor = await prisma.user.findUnique({
      where: { id: PROTECTED_USER_ID },
      select: { id: true },
    });
    if (!actor) {
      throw new Error("Admin user missing; refusing geocode.");
    }

    const companies = await prisma.company.findMany({
      where: { id: { not: PROTECTED_COMPANY_ID } },
      select: {
        id: true,
        name: true,
        address: true,
        postalCode: true,
        city: true,
        country: true,
        latitude: true,
        longitude: true,
        geocodedAddress: true,
        geocodeStatus: true,
      },
      orderBy: { name: "asc" },
    });

    const results = [];
    for (const [index, company] of companies.entries()) {
      const plan = planCompanyGeocode(company);
      if (plan.action === "skip") {
        results.push({ id: company.id, name: company.name, result: plan.reason, lat: company.latitude });
        continue;
      }

      if (plan.action === "mark_manual") {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            geocodeStatus: "MANUAL",
            geocodedAddress: plan.query || null,
            geocodedAt: new Date(),
          },
        });
        results.push({ id: company.id, name: company.name, result: "manual", lat: null });
        continue;
      }

      const hit = await fetchNominatimHit(plan.query, userAgent);
      if (!hit) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            geocodeStatus: "FAILED",
            geocodedAddress: plan.query,
            geocodedAt: new Date(),
          },
        });
        results.push({ id: company.id, name: company.name, result: "failed", lat: null });
      } else {
        await prisma.$transaction(async (tx) => {
          await tx.company.update({
            where: { id: company.id },
            data: {
              latitude: hit.lat,
              longitude: hit.lon,
              geocodedAddress: plan.query,
              geocodedAt: new Date(),
              geocodeStatus: "OK",
            },
          });
          await tx.activityLog.create({
            data: {
              actorId: actor.id,
              entityType: "Company",
              entityId: company.id,
              action: "company.geocoded",
              metadata: { lat: hit.lat, lng: hit.lon, source: "geocode-missing" },
            },
          });
        });
        results.push({
          id: company.id,
          name: company.name,
          result: "ok",
          lat: hit.lat,
          lng: hit.lon,
        });
      }

      if (index < companies.length - 1) {
        await sleep(NOMINATIM_GAP_MS);
      }
    }

    const alex = await prisma.company.findUnique({
      where: { id: PROTECTED_COMPANY_ID },
      select: { id: true, name: true, latitude: true, longitude: true, geocodeStatus: true },
    });

    console.info(JSON.stringify({ alex, results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "geocode_failed");
  process.exit(1);
});
