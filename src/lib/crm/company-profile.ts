import {
  type CompanyEditableField,
  isCompanyEditableField,
} from "@/lib/crm/company-fields";

/**
 * Fiche fields shown inline. Description stays in the notes block / full dialog.
 * Ten fields so the percent is a multiple of 10.
 */
export const COMPANY_PROFILE_FIELDS = [
  "email",
  "phone",
  "website",
  "address",
  "city",
  "postalCode",
  "instagram",
  "linkedin",
  "industry",
  "source",
] as const satisfies readonly CompanyEditableField[];

export type CompanyProfileField = (typeof COMPANY_PROFILE_FIELDS)[number];

export type CompanyProfileSnapshot = Record<CompanyProfileField, string | null | undefined>;

export function companyProfileCompleteness(company: CompanyProfileSnapshot): number {
  const filled = COMPANY_PROFILE_FIELDS.filter((field) => {
    const value = company[field];
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  return Math.round((filled / COMPANY_PROFILE_FIELDS.length) * 100);
}

export function isCompanyProfileField(field: string): field is CompanyProfileField {
  return isCompanyEditableField(field) && (COMPANY_PROFILE_FIELDS as readonly string[]).includes(field);
}
