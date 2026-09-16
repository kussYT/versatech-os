import { flattenError, z } from "zod";
import {
  CompanyLifecycle,
  Priority,
} from "@/generated/prisma/client";
import { emptyToNull, normalizeWebsite } from "@/lib/crm/form-data";

const optionalText = z.string().transform((value) => emptyToNull(value));

const optionalEmail = z
  .string()
  .transform((value) => emptyToNull(value))
  .pipe(z.email("E-mail invalide").nullable());

const optionalWebsite = z
  .string()
  .transform((value) => normalizeWebsite(emptyToNull(value)))
  .pipe(z.url("URL invalide").nullable());

export const createCompanySchema = z
  .object({
    name: z.string().trim().min(1, "Le nom de l'entreprise est obligatoire"),
    industry: optionalText,
    city: optionalText,
    phone: optionalText,
    email: optionalEmail,
    website: optionalWebsite,
    source: optionalText,
    description: optionalText,
    contactFirstName: optionalText,
    contactLastName: optionalText,
    contactRole: optionalText,
  })
  .superRefine((value, ctx) => {
    const hasContactHint = Boolean(
      value.contactFirstName || value.contactLastName || value.contactRole,
    );

    if (!hasContactHint) {
      return;
    }

    if (!value.contactFirstName) {
      ctx.addIssue({
        code: "custom",
        path: ["contactFirstName"],
        message: "Le prénom du contact est obligatoire",
      });
    }

    if (!value.contactLastName) {
      ctx.addIssue({
        code: "custom",
        path: ["contactLastName"],
        message: "Le nom du contact est obligatoire",
      });
    }
  });

export const updateCompanySchema = createCompanySchema.extend({
  id: z.string().min(1, "Entreprise introuvable"),
  lifecycleStatus: z.enum(CompanyLifecycle),
  priority: z.enum(Priority),
  contactPhone: optionalText,
  contactEmail: optionalEmail,
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export function fieldErrorsFromZod(error: z.ZodError) {
  return flattenError(error).fieldErrors;
}
