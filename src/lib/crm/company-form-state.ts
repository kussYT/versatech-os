/**
 * Controlled form state for the prospect and company dialogs.
 * React 19 resets uncontrolled inputs after a Server Action, including fields
 * inside a closed disclosure. This state is what survives a validation error.
 */

export type ProspectFormState = {
  name: string;
  industry: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  linkedin: string;
  source: string;
  description: string;
  contactFirstName: string;
  contactLastName: string;
  contactRole: string;
};

export type EditCompanyFormState = ProspectFormState & {
  lifecycleStatus: string;
  priority: string;
  contactPhone: string;
  contactEmail: string;
};

export type EditCompanyFormSource = {
  name: string;
  lifecycleStatus: string;
  priority: string;
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
  contacts: Array<{
    firstName: string;
    lastName: string;
    role: string | null;
    phone: string | null;
    email: string | null;
  }>;
};

export function emptyProspectForm(): ProspectFormState {
  return {
    name: "",
    industry: "",
    address: "",
    city: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    instagram: "",
    linkedin: "",
    source: "",
    description: "",
    contactFirstName: "",
    contactLastName: "",
    contactRole: "",
  };
}

export function patchCompanyForm<T extends Record<string, string>>(
  form: T,
  key: keyof T & string,
  value: string,
): T {
  return { ...form, [key]: value };
}

export function editCompanyFormState(company: EditCompanyFormSource): EditCompanyFormState {
  const contact = company.contacts[0];
  return {
    name: company.name,
    industry: company.industry ?? "",
    address: company.address ?? "",
    city: company.city ?? "",
    postalCode: company.postalCode ?? "",
    phone: company.phone ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    instagram: company.instagram ? `@${company.instagram}` : "",
    linkedin: company.linkedin ?? "",
    source: company.source ?? "",
    description: company.description ?? "",
    contactFirstName: contact?.firstName ?? "",
    contactLastName: contact?.lastName ?? "",
    contactRole: contact?.role ?? "",
    lifecycleStatus: company.lifecycleStatus,
    priority: company.priority,
    contactPhone: contact?.phone ?? "",
    contactEmail: contact?.email ?? "",
  };
}
