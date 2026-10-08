import { flattenError, z } from "zod";
import {
  CompanyLifecycle,
  Priority,
} from "@/generated/prisma/client";
import {
  COMPANY_EDITABLE_FIELDS,
  type CompanyEditableField,
  isCompanyEditableField,
} from "@/lib/crm/company-fields";
import { emptyToNull, normalizeWebsite } from "@/lib/crm/form-data";
import { normalizeInstagramHandle, normalizeLinkedinUrl, type SocialParseResult } from "@/lib/crm/social";

export { COMPANY_EDITABLE_FIELDS, isCompanyEditableField, type CompanyEditableField };

export const CONTACT_FIRST_NAME_REQUIRED_MESSAGE =
  "Ajoutez le prénom du contact (prénom et nom sont nécessaires pour créer le contact)";
export const CONTACT_LAST_NAME_REQUIRED_MESSAGE =
  "Ajoutez le nom du contact (prénom et nom sont nécessaires pour créer le contact)";

/** Accepts FormData strings and already-parsed `null`, so service re-validation is idempotent. */
const nullableString = z.string().nullish();

const optionalText = nullableString.transform((value) => emptyToNull(value ?? ""));

const optionalEmail = optionalText.pipe(z.email("E-mail invalide").nullable());

const optionalWebsite = optionalText
  .transform((value) => normalizeWebsite(value))
  .pipe(z.url("URL invalide").nullable());

function socialField(normalize: (raw: string | null | undefined) => SocialParseResult) {
  return nullableString.transform((value, ctx) => {
    const result = normalize(value);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }
    return result.value;
  });
}

export const companyFieldSchemas = {
  email: optionalEmail,
  phone: optionalText,
  website: optionalWebsite,
  address: optionalText,
  city: optionalText,
  postalCode: optionalText,
  instagram: socialField(normalizeInstagramHandle),
  linkedin: socialField(normalizeLinkedinUrl),
  industry: optionalText,
  source: optionalText,
  description: optionalText,
} satisfies Record<CompanyEditableField, z.ZodType<string | null>>;

const companyFields = {
  name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire"),
  address: companyFieldSchemas.address,
  industry: companyFieldSchemas.industry,
  city: companyFieldSchemas.city,
  postalCode: companyFieldSchemas.postalCode,
  phone: companyFieldSchemas.phone,
  email: companyFieldSchemas.email,
  website: companyFieldSchemas.website,
  instagram: companyFieldSchemas.instagram,
  linkedin: companyFieldSchemas.linkedin,
  source: companyFieldSchemas.source,
  description: companyFieldSchemas.description,
  contactFirstName: optionalText,
  contactLastName: optionalText,
  contactRole: optionalText,
};

export const COMPANY_FIELD_UNKNOWN_MESSAGE = "Ce champ ne peut pas être modifié ici.";

/** Shape only. Per-field rules stay on `companyFieldSchemas`, not the full company form. */
export const updateCompanyFieldActionSchema = z.object({
  companyId: z.string().trim().min(1, "Entreprise introuvable."),
  field: z.string().trim().min(1, COMPANY_FIELD_UNKNOWN_MESSAGE),
  value: z.string(),
});

export function parseCompanyEditableField(field: CompanyEditableField, raw: string) {
  const parsed = companyFieldSchemas[field].safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Valeur invalide.";
    return { ok: false as const, message };
  }
  return { ok: true as const, value: parsed.data };
}

type ContactHint = {
  contactFirstName: string | null;
  contactLastName: string | null;
  contactRole: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

/**
 * Contact.firstName/lastName are NOT NULL: a contact is only written with both names.
 * Any other contact detail without both names is rejected with a field message
 * instead of being silently dropped.
 */
function requireContactNames(value: ContactHint, ctx: z.RefinementCtx) {
  const hasContactHint = Boolean(
    value.contactFirstName ||
      value.contactLastName ||
      value.contactRole ||
      value.contactPhone ||
      value.contactEmail,
  );

  if (!hasContactHint) {
    return;
  }

  if (!value.contactFirstName) {
    ctx.addIssue({
      code: "custom",
      path: ["contactFirstName"],
      message: CONTACT_FIRST_NAME_REQUIRED_MESSAGE,
    });
  }

  if (!value.contactLastName) {
    ctx.addIssue({
      code: "custom",
      path: ["contactLastName"],
      message: CONTACT_LAST_NAME_REQUIRED_MESSAGE,
    });
  }
}

export const createCompanySchema = z.object(companyFields).superRefine(requireContactNames);

export const updateCompanySchema = z
  .object({
    ...companyFields,
    id: z.string().min(1, "Entreprise introuvable"),
    lifecycleStatus: z.enum(CompanyLifecycle),
    priority: z.enum(Priority),
    contactPhone: optionalText,
    contactEmail: optionalEmail,
  })
  .superRefine(requireContactNames);

export type CreateCompanyFormInput = z.input<typeof createCompanySchema>;
export type UpdateCompanyFormInput = z.input<typeof updateCompanySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export function fieldErrorsFromZod(error: z.ZodError) {
  return flattenError(error).fieldErrors;
}
