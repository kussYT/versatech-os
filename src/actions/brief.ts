"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  isBriefVerificationStatus,
  parseCommercialBrief,
  serializeCommercialBrief,
} from "@/lib/prospection/brief";

export async function updateCommercialBrief(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const companyId = readString(formData, "companyId");
  const verificationRaw = readString(formData, "verificationStatus");

  if (!companyId) {
    return { ok: false, message: "Entreprise introuvable." };
  }

  const brief = serializeCommercialBrief(
    parseCommercialBrief({
      digitalPresence: readString(formData, "digitalPresence"),
      strengths: readString(formData, "strengths"),
      opportunities: readString(formData, "opportunities"),
      proposal: readString(formData, "proposal"),
      angle: readString(formData, "angle"),
      verificationStatus: isBriefVerificationStatus(verificationRaw)
        ? verificationRaw
        : "UNVERIFIED",
    }),
  );

  try {
    const existing = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!existing) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: { commercialBrief: brief },
      });
      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Company",
          entityId: companyId,
          action: "company.brief_updated",
          metadata: { verificationStatus: brief.verificationStatus },
        },
      });
    });

    revalidateCrm(companyId);
    return { ok: true, data: { companyId } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: "Impossible d'enregistrer le brief. Réessayez." };
  }
}
