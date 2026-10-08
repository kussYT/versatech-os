import "server-only";

import type { CompanyLifecycle, GeocodeStatus, Priority as CompanyPriority } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { validateManualLifecycle } from "@/lib/crm/lifecycle";
import { verifySensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import {
  applyCompanyLifecycleChange,
  countCompanyLifecycleFacts,
  type LifecycleDb,
} from "@/lib/crm/lifecycle-db";
import { geocodeStatusResetForAddressChange } from "@/lib/prospection/geocode";
import {
  fieldErrorsFromZod,
  serviceFail,
  serviceOk,
  type ServiceResult,
} from "@/lib/services/_shared/result";
import {
  COMPANY_FIELD_UNKNOWN_MESSAGE,
  createCompanySchema,
  isCompanyEditableField,
  parseCompanyEditableField,
  updateCompanyFieldActionSchema,
  updateCompanySchema,
  type CreateCompanyFormInput,
  type UpdateCompanyFormInput,
} from "@/lib/validations/company";

export const COMPANY_VALIDATION_MESSAGE = "Vérifiez les champs du formulaire.";
export const COMPANY_NOT_FOUND_MESSAGE = "Entreprise introuvable.";

type CompanyLocation = {
  address: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  geocodeStatus: GeocodeStatus | null;
};

type CompanyFieldUpdate = Partial<CompanyProfileData> & { geocodeStatus?: null };

type CompanyProfileData = {
  name: string;
  industry: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  source: string | null;
  description: string | null;
};

type ContactData = {
  firstName: string;
  lastName: string;
  role: string | null;
  phone?: string | null;
  email?: string | null;
  isPrimary: true;
};

type ActivityMetadata = Record<string, string | number | boolean | null>;

export type CompanyWriteTx = {
  company: {
    findUnique: (args: {
      where: { id: string };
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }];
          take: 1;
        };
      };
    }) => Promise<{
      id: string;
      lifecycleStatus: CompanyLifecycle;
      address: string | null;
      city: string | null;
      postalCode: string | null;
      latitude: number | null;
      longitude: number | null;
      geocodeStatus: GeocodeStatus | null;
      contacts: Array<{ id: string }>;
    } | null>;
    create: (args: {
      data: CompanyProfileData & {
        lifecycleStatus: "LEAD";
        priority: "NORMAL";
        country: "FR";
      };
    }) => Promise<{ id: string; name: string }>;
    update: (args: {
      where: { id: string };
      data:
        | (CompanyProfileData & { priority: CompanyPriority; geocodeStatus?: null })
        | { lifecycleStatus: CompanyLifecycle }
        | CompanyFieldUpdate;
    }) => Promise<unknown>;
  };
  contact: {
    create: (args: { data: ContactData & { companyId: string } }) => Promise<unknown>;
    update: (args: { where: { id: string }; data: ContactData }) => Promise<unknown>;
  };
  opportunity: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
  quote: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
  project: { count: (args: { where: Record<string, unknown> }) => Promise<number> };
  activityLog: {
    create: (args: {
      data: {
        actorId: string;
        entityType: "Company";
        entityId: string;
        action: string;
        metadata: ActivityMetadata;
      };
    }) => Promise<unknown>;
  };
};

export type CompanyWriteStore = {
  $transaction: <T>(fn: (tx: CompanyWriteTx) => Promise<T>) => Promise<T>;
};

export type CompanyWriteDeps = {
  store?: CompanyWriteStore;
  secret?: string;
  now?: Date;
  confirmationToken?: string | null;
};

async function resolveStore(store?: CompanyWriteStore): Promise<CompanyWriteStore> {
  if (store) {
    return store;
  }
  const { prisma } = await import("@/lib/db/prisma");
  return prisma as unknown as CompanyWriteStore;
}

function requireActorId(actor: SessionUser | null | undefined): ServiceResult<never> | null {
  if (!actor?.id) {
    return serviceFail("AUTH_REQUIRED", "Authentification requise.");
  }
  return null;
}

function lifecycleDb(tx: CompanyWriteTx): LifecycleDb {
  return tx as unknown as LifecycleDb;
}

/**
 * Crée un prospect (Lead). Seul `name` est obligatoire.
 * Contact principal créé uniquement avec prénom + nom. ActivityLog dans la transaction.
 */
export async function createCompany(
  input: CreateCompanyFormInput,
  actor: SessionUser,
  deps: CompanyWriteDeps = {},
): Promise<ServiceResult<{ companyId: string; name: string }>> {
  const authError = requireActorId(actor);
  if (authError) {
    return authError;
  }

  const parsed = createCompanySchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail("VALIDATION", COMPANY_VALIDATION_MESSAGE, fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const store = await resolveStore(deps.store);
  const company = await store.$transaction(async (tx) => {
    const created = await tx.company.create({
      data: {
        name: data.name,
        lifecycleStatus: "LEAD",
        industry: data.industry,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        website: data.website,
        instagram: data.instagram,
        linkedin: data.linkedin,
        source: data.source,
        description: data.description,
        priority: "NORMAL",
        country: "FR",
      },
    });

    if (data.contactFirstName && data.contactLastName) {
      await tx.contact.create({
        data: {
          companyId: created.id,
          firstName: data.contactFirstName,
          lastName: data.contactLastName,
          role: data.contactRole,
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

  return serviceOk({ companyId: company.id, name: company.name });
}

/**
 * Met à jour la fiche. Le changement de statut manuel passe par
 * `validateManualLifecycle` + `applyCompanyLifecycleChange` (journal `company.lifecycle_changed`).
 */
export async function updateCompany(
  input: UpdateCompanyFormInput,
  actor: SessionUser,
  deps: CompanyWriteDeps = {},
): Promise<ServiceResult<{ companyId: string }>> {
  const authError = requireActorId(actor);
  if (authError) {
    return authError;
  }

  const parsed = updateCompanySchema.safeParse(input);
  if (!parsed.success) {
    return serviceFail("VALIDATION", COMPANY_VALIDATION_MESSAGE, fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const store = await resolveStore(deps.store);
  return store.$transaction(async (tx): Promise<ServiceResult<{ companyId: string }>> => {
    const existing = await tx.company.findUnique({
      where: { id: data.id },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    });

    if (!existing) {
      return serviceFail("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }

    const facts = await countCompanyLifecycleFacts(
      lifecycleDb(tx),
      existing.id,
      existing.lifecycleStatus,
    );
    const lifecycleCheck = validateManualLifecycle(data.lifecycleStatus, facts);
    if (!lifecycleCheck.ok) {
      return serviceFail("VALIDATION", lifecycleCheck.message, {
        lifecycleStatus: [lifecycleCheck.message],
      });
    }

    if (
      (data.lifecycleStatus === "CLIENT" || data.lifecycleStatus === "LOST") &&
      data.lifecycleStatus !== existing.lifecycleStatus
    ) {
      const confirmed = deps.secret
        ? verifySensitiveIntent(
            deps.confirmationToken,
            {
              kind: "company-lifecycle",
              actorId: actor.id,
              companyId: existing.id,
              lifecycle: data.lifecycleStatus,
            },
            deps.secret,
            deps.now,
          )
        : false;
      if (!confirmed) {
        return serviceFail(
          "CONFIRMATION_REQUIRED",
          "Confirmation serveur requise pour Client ou Perdu.",
        );
      }
    }

    const profile = {
      name: data.name,
      industry: data.industry,
      address: data.address,
      city: data.city,
      postalCode: data.postalCode,
      phone: data.phone,
      email: data.email,
      website: data.website,
      instagram: data.instagram,
      linkedin: data.linkedin,
      source: data.source,
      description: data.description,
      priority: data.priority,
    };

    const geocodeReset = geocodeStatusResetForAddressChange(existing, data);

    await tx.company.update({
      where: { id: existing.id },
      data: geocodeReset ? { ...profile, ...geocodeReset } : profile,
    });

    await applyCompanyLifecycleChange(lifecycleDb(tx), {
      companyId: existing.id,
      from: existing.lifecycleStatus,
      to: data.lifecycleStatus,
      actorId: actor.id,
      reason: "company.updated",
    });

    if (data.contactFirstName && data.contactLastName) {
      const contact: ContactData = {
        firstName: data.contactFirstName,
        lastName: data.contactLastName,
        role: data.contactRole,
        phone: data.contactPhone,
        email: data.contactEmail,
        isPrimary: true,
      };
      const primaryContact = existing.contacts[0] ?? null;
      if (primaryContact) {
        await tx.contact.update({ where: { id: primaryContact.id }, data: contact });
      } else {
        await tx.contact.create({ data: { companyId: existing.id, ...contact } });
      }
    }

    await tx.activityLog.create({
      data: {
        actorId: actor.id,
        entityType: "Company",
        entityId: existing.id,
        action: "company.updated",
        metadata: { name: data.name },
      },
    });

    return serviceOk({ companyId: existing.id });
  });
}

function locationAfterField(
  existing: CompanyLocation,
  field: string,
  value: string | null,
): CompanyLocation {
  if (field === "address" || field === "city" || field === "postalCode") {
    return { ...existing, [field]: value };
  }
  return existing;
}

/**
 * Met à jour exactement une colonne.
 * `company.updated` est un audit technique (metadata.field seulement) : la timeline
 * de la fiche n'affiche que les Interaction, pas ces lignes, et les lecteurs
 * d'activité n'exposent pas `metadata`.
 * Un changement d'adresse, de ville ou de code postal remet `geocodeStatus` à null
 * seulement si la fiche n'a pas de coordonnées : le batch Nominatim existant peut
 * alors reprendre une fiche MANUAL. Aucun appel live — un échec ou une config
 * absente ne peut pas faire échouer la sauvegarde.
 */
export async function updateCompanyField(
  companyId: string,
  field: string,
  value: string,
  actor: SessionUser,
  deps: CompanyWriteDeps = {},
): Promise<ServiceResult<{ companyId: string; savedValue: string | null }>> {
  const authError = requireActorId(actor);
  if (authError) {
    return authError;
  }

  const parsedInput = updateCompanyFieldActionSchema.safeParse({ companyId, field, value });
  if (!parsedInput.success) {
    return serviceFail("VALIDATION", COMPANY_VALIDATION_MESSAGE, fieldErrorsFromZod(parsedInput.error));
  }

  const editableField = parsedInput.data.field;
  if (!isCompanyEditableField(editableField)) {
    return serviceFail("VALIDATION", COMPANY_FIELD_UNKNOWN_MESSAGE, {
      field: [COMPANY_FIELD_UNKNOWN_MESSAGE],
    });
  }

  const parsedValue = parseCompanyEditableField(editableField, parsedInput.data.value);
  if (!parsedValue.ok) {
    return serviceFail("VALIDATION", COMPANY_VALIDATION_MESSAGE, {
      [editableField]: [parsedValue.message],
    });
  }

  const store = await resolveStore(deps.store);
  return store.$transaction(async (tx): Promise<ServiceResult<{ companyId: string; savedValue: string | null }>> => {
    const existing = await tx.company.findUnique({
      where: { id: parsedInput.data.companyId },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    });

    if (!existing) {
      return serviceFail("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }

    const data: CompanyFieldUpdate = { [editableField]: parsedValue.value };
    const geocodeReset = geocodeStatusResetForAddressChange(
      existing,
      locationAfterField(existing, editableField, parsedValue.value),
    );
    if (geocodeReset) {
      data.geocodeStatus = null;
    }

    await tx.company.update({
      where: { id: existing.id },
      data,
    });

    await tx.activityLog.create({
      data: {
        actorId: actor.id,
        entityType: "Company",
        entityId: existing.id,
        action: "company.updated",
        metadata: { field: editableField },
      },
    });

    return serviceOk({ companyId: existing.id, savedValue: parsedValue.value });
  });
}

const QUICK_COMPANY_LIFECYCLES = ["LEAD", "CONTACTED", "QUALIFIED", "OPPORTUNITY", "INACTIVE"] as const;

export async function changeCompanyLifecycle(
  input: { companyId: string; lifecycleStatus: CompanyLifecycle },
  actor: SessionUser,
  deps: CompanyWriteDeps = {},
): Promise<ServiceResult<{ companyId: string; unchanged: boolean }>> {
  const authError = requireActorId(actor);
  if (authError) {
    return authError;
  }

  if (
    !QUICK_COMPANY_LIFECYCLES.includes(
      input.lifecycleStatus as (typeof QUICK_COMPANY_LIFECYCLES)[number],
    )
  ) {
    return serviceFail(
      "VALIDATION",
      "Client et Perdu se confirment depuis le formulaire complet.",
    );
  }

  const store = await resolveStore(deps.store);
  return store.$transaction(async (tx) => {
    const existing = await tx.company.findUnique({
      where: { id: input.companyId },
      include: {
        contacts: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    });
    if (!existing) {
      return serviceFail("NOT_FOUND", COMPANY_NOT_FOUND_MESSAGE);
    }
    if (existing.lifecycleStatus === input.lifecycleStatus) {
      return serviceOk({ companyId: existing.id, unchanged: true });
    }

    const facts = await countCompanyLifecycleFacts(
      lifecycleDb(tx),
      existing.id,
      existing.lifecycleStatus,
    );
    const lifecycleCheck = validateManualLifecycle(input.lifecycleStatus, facts);
    if (!lifecycleCheck.ok) {
      return serviceFail("VALIDATION", lifecycleCheck.message);
    }

    await applyCompanyLifecycleChange(lifecycleDb(tx), {
      companyId: existing.id,
      from: existing.lifecycleStatus,
      to: input.lifecycleStatus,
      actorId: actor.id,
      reason: "company.lifecycle_manual",
    });

    return serviceOk({ companyId: existing.id, unchanged: false });
  });
}
