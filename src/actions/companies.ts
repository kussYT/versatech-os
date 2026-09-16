"use server";

import type { ActionResult } from "@/lib/crm/action-result";
import { requireActor } from "@/lib/crm/actor";
import { readString } from "@/lib/crm/form-data";
import { revalidateCrm } from "@/lib/crm/revalidate";
import { prisma } from "@/lib/db/prisma";
import {
  createCompanySchema,
  fieldErrorsFromZod,
  updateCompanySchema,
} from "@/lib/validations/company";

function userFacingDbError() {
  return "Impossible d'enregistrer l'entreprise. Réessayez.";
}

export async function createCompany(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = createCompanySchema.safeParse({
    name: readString(formData, "name"),
    industry: readString(formData, "industry"),
    city: readString(formData, "city"),
    phone: readString(formData, "phone"),
    email: readString(formData, "email"),
    website: readString(formData, "website"),
    source: readString(formData, "source"),
    description: readString(formData, "description"),
    contactFirstName: readString(formData, "contactFirstName"),
    contactLastName: readString(formData, "contactLastName"),
    contactRole: readString(formData, "contactRole"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const company = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: {
          name: input.name,
          lifecycleStatus: "LEAD",
          industry: input.industry,
          city: input.city,
          phone: input.phone,
          email: input.email,
          website: input.website,
          source: input.source,
          description: input.description,
          priority: "NORMAL",
          country: "FR",
        },
      });

      if (input.contactFirstName && input.contactLastName) {
        await tx.contact.create({
          data: {
            companyId: created.id,
            firstName: input.contactFirstName,
            lastName: input.contactLastName,
            role: input.contactRole,
            isPrimary: true,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Company",
          entityId: created.id,
          action: "company.created",
          metadata: { name: created.name },
        },
      });

      return created;
    });

    revalidateCrm(company.id);
    return { ok: true, data: { companyId: company.id, name: company.name } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: userFacingDbError() };
  }
}

export async function updateCompany(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireActor();
  if (!auth.ok) {
    return auth.result;
  }
  const { actor } = auth;
  const parsed = updateCompanySchema.safeParse({
    id: readString(formData, "id"),
    name: readString(formData, "name"),
    industry: readString(formData, "industry"),
    city: readString(formData, "city"),
    phone: readString(formData, "phone"),
    email: readString(formData, "email"),
    website: readString(formData, "website"),
    source: readString(formData, "source"),
    description: readString(formData, "description"),
    lifecycleStatus: readString(formData, "lifecycleStatus"),
    priority: readString(formData, "priority"),
    contactFirstName: readString(formData, "contactFirstName"),
    contactLastName: readString(formData, "contactLastName"),
    contactRole: readString(formData, "contactRole"),
    contactPhone: readString(formData, "contactPhone"),
    contactEmail: readString(formData, "contactEmail"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vérifiez les champs du formulaire.",
      fieldErrors: fieldErrorsFromZod(parsed.error),
    };
  }

  const input = parsed.data;

  try {
    const existing = await prisma.company.findUnique({
      where: { id: input.id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    });

    if (!existing) {
      return { ok: false, message: "Entreprise introuvable." };
    }

    const primaryContact = existing.contacts[0] ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          industry: input.industry,
          city: input.city,
          phone: input.phone,
          email: input.email,
          website: input.website,
          source: input.source,
          description: input.description,
          lifecycleStatus: input.lifecycleStatus,
          priority: input.priority,
        },
      });

      if (input.contactFirstName && input.contactLastName) {
        if (primaryContact) {
          await tx.contact.update({
            where: { id: primaryContact.id },
            data: {
              firstName: input.contactFirstName,
              lastName: input.contactLastName,
              role: input.contactRole,
              phone: input.contactPhone,
              email: input.contactEmail,
              isPrimary: true,
            },
          });
        } else {
          await tx.contact.create({
            data: {
              companyId: existing.id,
              firstName: input.contactFirstName,
              lastName: input.contactLastName,
              role: input.contactRole,
              phone: input.contactPhone,
              email: input.contactEmail,
              isPrimary: true,
            },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          actorId: actor.id,
          entityType: "Company",
          entityId: existing.id,
          action: "company.updated",
          metadata: { name: input.name },
        },
      });
    });

    revalidateCrm(existing.id);
    return { ok: true, data: { companyId: existing.id } };
  } catch (error) {
    console.error(error);
    return { ok: false, message: userFacingDbError() };
  }
}
