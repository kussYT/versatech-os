import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PROTECTED_COMPANY_ID, PROTECTED_USER_ID } from "../src/lib/db/demo-cleanup-guard";
import { getDatabaseUrl } from "../src/lib/db/env";
import { assertTerrainProspectImportAllowed } from "../src/lib/db/terrain-import-guard";
import {
  geocodeQueryForCompany,
  isNominatimConfigured,
  nominatimRequestInit,
  nominatimSearchUrl,
  parseNominatimHit,
  shouldSkipGeocode,
} from "../src/lib/prospection/geocode";
import {
  TERRAIN_PROSPECTS,
  terrainProspectRecord,
} from "../src/lib/prospection/terrain-prospects";
import { addCompanyToStops } from "../src/lib/prospection/tour";

const NOMINATIM_GAP_MS = 1_100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodeIfPossible(
  prisma: PrismaClient,
  actorId: string,
  companyId: string,
) {
  if (!isNominatimConfigured()) {
    return { geocoded: false, reason: "nominatim_unconfigured" as const };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return { geocoded: false, reason: "missing" as const };
  }

  const query = geocodeQueryForCompany(company);
  if (shouldSkipGeocode(company, query)) {
    return { geocoded: false, reason: "skipped" as const };
  }

  try {
    const response = await fetch(
      nominatimSearchUrl(query),
      nominatimRequestInit(process.env.NOMINATIM_USER_AGENT!.trim()),
    );
    if (!response.ok) {
      await prisma.company.update({
        where: { id: company.id },
        data: { geocodeStatus: "FAILED" },
      });
      return { geocoded: false, reason: "unavailable" as const };
    }

    const hit = parseNominatimHit(await response.json());
    if (!hit) {
      await prisma.company.update({
        where: { id: company.id },
        data: { geocodeStatus: "FAILED" },
      });
      return { geocoded: false, reason: "not_found" as const };
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: company.id },
        data: {
          latitude: hit.lat,
          longitude: hit.lon,
          geocodedAddress: query,
          geocodedAt: new Date(),
          geocodeStatus: "OK",
        },
      });
      await tx.activityLog.create({
        data: {
          actorId,
          entityType: "Company",
          entityId: company.id,
          action: "company.geocoded",
          metadata: { lat: hit.lat, lng: hit.lon, source: "terrain-import" },
        },
      });
    });

    return { geocoded: true, reason: "ok" as const };
  } catch {
    return { geocoded: false, reason: "error" as const };
  }
}

async function importOne(prisma: PrismaClient, actorId: string, name: (typeof TERRAIN_PROSPECTS)[number]["name"]) {
  const draft = TERRAIN_PROSPECTS.find((prospect) => prospect.name === name);
  if (!draft) {
    throw new Error(`Unknown terrain prospect: ${name}`);
  }

  const record = terrainProspectRecord(draft);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.company.findFirst({
      where: { name: record.name },
      select: {
        id: true,
        name: true,
        commercialBrief: true,
        source: true,
      },
    });

    if (existing?.id === PROTECTED_COMPANY_ID || existing?.name === "ALEX'CEPTION") {
      throw new Error("Refusing to mutate ALEX'CEPTION during terrain prospect import.");
    }

    let companyId: string;
    let created = false;

    if (existing) {
      companyId = existing.id;
      if (!existing.commercialBrief) {
        await tx.company.update({
          where: { id: companyId },
          data: { commercialBrief: record.commercialBrief },
        });
      }
      if (!existing.source) {
        await tx.company.update({
          where: { id: companyId },
          data: { source: record.source },
        });
      }
    } else {
      const createdCompany = await tx.company.create({
        data: {
          name: record.name,
          lifecycleStatus: "LEAD",
          industry: record.industry,
          address: record.address,
          postalCode: record.postalCode,
          city: record.city,
          country: record.country,
          phone: record.phone,
          website: record.website,
          source: record.source,
          commercialBrief: record.commercialBrief,
          priority: "NORMAL",
        },
      });
      companyId = createdCompany.id;
      created = true;
      await tx.activityLog.create({
        data: {
          actorId,
          entityType: "Company",
          entityId: companyId,
          action: "company.created",
          metadata: {
            name: record.name,
            source: record.source,
            import: "terrain-prospects",
          },
        },
      });
    }

    const tour = await tx.tour.upsert({
      where: { date: record.tourDate },
      update: {},
      create: { date: record.tourDate, createdById: actorId },
    });

    const stops = await tx.tourStop.findMany({
      where: { tourId: tour.id },
      select: { companyId: true, order: true, visitedAt: true },
    });
    const alreadyOnTour = stops.some((stop) => stop.companyId === companyId);

    if (!alreadyOnTour) {
      const next = addCompanyToStops(
        stops.map((stop) => ({
          companyId: stop.companyId,
          order: stop.order,
          visitedAt: stop.visitedAt,
        })),
        companyId,
      );
      const added = next.find((stop) => stop.companyId === companyId);
      await tx.tourStop.create({
        data: {
          tourId: tour.id,
          companyId,
          order: added?.order ?? 1,
          visitedAt: null,
        },
      });
      await tx.activityLog.create({
        data: {
          actorId,
          entityType: "Tour",
          entityId: tour.id,
          action: "tour.stop_added",
          metadata: {
            companyId,
            date: record.tourDate.toISOString(),
            import: "terrain-prospects",
          },
        },
      });
    }

    return {
      name: record.name,
      companyId,
      created,
      tourId: tour.id,
      tourDate: record.tourDate.toISOString(),
      visitLabel: record.visitLabel,
    };
  });
}

async function main() {
  assertTerrainProspectImportAllowed();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
  });

  try {
    const actor = await prisma.user.findUnique({
      where: { id: PROTECTED_USER_ID },
      select: { id: true, email: true },
    });
    if (!actor) {
      throw new Error("Admin user missing; refusing terrain import.");
    }

    const alex = await prisma.company.findUnique({
      where: { id: PROTECTED_COMPANY_ID },
      select: { id: true, name: true, lifecycleStatus: true },
    });
    if (!alex || alex.name !== "ALEX'CEPTION") {
      throw new Error("ALEX'CEPTION missing or renamed; refusing terrain import.");
    }

    const results = [];
    for (const [index, draft] of TERRAIN_PROSPECTS.entries()) {
      const imported = await importOne(prisma, actor.id, draft.name);
      const geo = await geocodeIfPossible(prisma, actor.id, imported.companyId);
      results.push({ ...imported, geocode: geo });
      if (index < TERRAIN_PROSPECTS.length - 1 && geo.reason !== "nominatim_unconfigured") {
        await sleep(NOMINATIM_GAP_MS);
      }
    }

    const alexAfter = await prisma.company.findUnique({
      where: { id: PROTECTED_COMPANY_ID },
      select: { id: true, name: true, lifecycleStatus: true },
    });
    const counts = await prisma.company.groupBy({
      by: ["name"],
      where: { name: { in: TERRAIN_PROSPECTS.map((prospect) => prospect.name) } },
      _count: { _all: true },
    });

    console.info(
      JSON.stringify(
        {
          actor: { id: actor.id, email: actor.email },
          alex: alexAfter,
          prospects: results,
          nameCounts: counts.map((row) => ({ name: row.name, count: row._count._all })),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "import_failed");
  process.exit(1);
});
