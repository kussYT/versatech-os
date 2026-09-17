"use server";

import { logServerError } from "@/lib/observability/log-error";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  geocodeQueryForCompany,
  isNominatimConfigured,
  nominatimRequestInit,
  nominatimSearchUrl,
  parseNominatimHit,
  shouldSkipGeocode,
} from "@/lib/prospection/geocode";
import { formatCompanyAddress } from "@/lib/prospection/map-model";

function revalidateMap(companyId: string) {
  revalidateCrm(companyId);
  // /carte added in revalidateCrm below via patch
}

export async function geocodeCompany(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");

  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  if (!isNominatimConfigured()) {
    return {
      ok: false,
      message:
        "Géocodage non configuré (NOMINATIM_USER_AGENT). Saisissez l'adresse et les coordonnées manuellement.",
    };
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const query = geocodeQueryForCompany(company);
    if (shouldSkipGeocode(company, query)) {
      return { ok: true, data: { companyId } };
    }

    const response = await fetch(
      nominatimSearchUrl(query),
      nominatimRequestInit(process.env.NOMINATIM_USER_AGENT!.trim()),
    );

    if (!response.ok) {
      await prisma.company.update({
        where: { id: company.id },
        data: { geocodeStatus: "FAILED" },
      });
      return { ok: false, message: "Géocodage indisponible. Réessayez plus tard." };
    }

    const hit = parseNominatimHit(await response.json());
    if (!hit) {
      await prisma.company.update({
        where: { id: company.id },
        data: { geocodeStatus: "FAILED" },
      });
      return { ok: false, message: "Adresse introuvable. Complétez la localisation manuellement." };
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
          actorId: actor.id,
          entityType: "Company",
          entityId: company.id,
          action: "company.geocoded",
          metadata: { lat: hit.lat, lng: hit.lon },
        },
      });
    });

    revalidateMap(company.id);
    return { ok: true, data: { companyId: company.id } };
  } catch (error) {
    logServerError("map", error);
    return { ok: false, message: "Impossible de géocoder cette adresse." };
  }
}

export async function saveCompanyLocation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");
  const latitude = Number(readString(formData, "latitude").replace(",", "."));
  const longitude = Number(readString(formData, "longitude").replace(",", "."));

  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      ok: false,
      message: "Latitude et longitude sont obligatoires.",
      fieldErrors: { latitude: ["Coordonnées invalides"] },
    };
  }

  try {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: company.id },
        data: {
          latitude,
          longitude,
          geocodedAddress: formatCompanyAddress(company) || company.name,
          geocodedAt: new Date(),
          geocodeStatus: "MANUAL",
        },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Company",
          entityId: company.id,
          action: "company.location_saved",
          metadata: { lat: latitude, lng: longitude },
        },
      });
    });

    revalidateMap(company.id);
    return { ok: true, data: { companyId: company.id } };
  } catch (error) {
    logServerError("map", error);
    return { ok: false, message: "Impossible d'enregistrer la localisation." };
  }
}

export async function geocodeCompanyForm(formData: FormData) {
  await geocodeCompany({ ok: false }, formData);
}

export async function saveCompanyLocationForm(formData: FormData) {
  await saveCompanyLocation({ ok: false }, formData);
}
