/** Columns a fiche can change one at a time. No lifecycle, priority, or name. */
export const COMPANY_EDITABLE_FIELDS = [
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
  "description",
] as const;

export type CompanyEditableField = (typeof COMPANY_EDITABLE_FIELDS)[number];

const EDITABLE_FIELD_SET = new Set<string>(COMPANY_EDITABLE_FIELDS);

export function isCompanyEditableField(field: string): field is CompanyEditableField {
  return EDITABLE_FIELD_SET.has(field);
}
