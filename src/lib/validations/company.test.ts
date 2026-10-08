import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_FIRST_NAME_REQUIRED_MESSAGE,
  CONTACT_LAST_NAME_REQUIRED_MESSAGE,
  createCompanySchema,
  updateCompanySchema,
} from "./company";

/** Same shape as `readString` output for an empty create form. */
const EMPTY_CREATE_FORM = {
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

describe("createCompanySchema — minimal prospect", () => {
  it("name only passes and every other field is null", () => {
    const parsed = createCompanySchema.parse({ ...EMPTY_CREATE_FORM, name: "  Studio Nord  " });
    assert.deepEqual(parsed, {
      name: "Studio Nord",
      industry: null,
      address: null,
      city: null,
      postalCode: null,
      phone: null,
      email: null,
      website: null,
      instagram: null,
      linkedin: null,
      source: null,
      description: null,
      contactFirstName: null,
      contactLastName: null,
      contactRole: null,
    });
  });

  it("name only passes when optional keys are absent", () => {
    const parsed = createCompanySchema.parse({ name: "Studio Nord" });
    assert.equal(parsed.address, null);
    assert.equal(parsed.instagram, null);
  });

  it("Maro Créa: instagram handle normalised, no email, no contact", () => {
    const parsed = createCompanySchema.parse({
      ...EMPTY_CREATE_FORM,
      name: "Maro Créa",
      instagram: "@maro.crea",
      industry: "photographie / communication / création de contenu",
      source: "Instagram",
      description: "site vitrine",
    });
    assert.equal(parsed.name, "Maro Créa");
    assert.equal(parsed.instagram, "maro.crea");
    assert.equal(parsed.email, null);
    assert.equal(parsed.address, null);
    assert.equal(parsed.phone, null);
    assert.equal(parsed.contactFirstName, null);
    assert.equal(parsed.contactLastName, null);
    assert.equal(parsed.industry, "photographie / communication / création de contenu");
    assert.equal(parsed.source, "Instagram");
    assert.equal(parsed.description, "site vitrine");
  });

  it("blank name fails", () => {
    const result = createCompanySchema.safeParse({ ...EMPTY_CREATE_FORM, name: "   " });
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((issue) => issue.path[0] === "name"));
  });

  it("invalid email, website, instagram, linkedin fail on their own field", () => {
    for (const [field, value] of [
      ["email", "pas-un-email"],
      ["website", "http://"],
      ["instagram", "maro crea"],
      ["linkedin", "https://evil.example/in/x"],
    ] as const) {
      const result = createCompanySchema.safeParse({
        ...EMPTY_CREATE_FORM,
        name: "Maro Créa",
        [field]: value,
      });
      assert.equal(result.success, false, field);
      assert.ok(result.error?.issues.some((issue) => issue.path[0] === field), field);
    }
  });

  it("legacy fully-filled input still passes with the same parsed output", () => {
    const parsed = createCompanySchema.parse({
      ...EMPTY_CREATE_FORM,
      name: "Atelier Lumière",
      industry: "Fleuriste",
      address: "12 rue des Fleurs",
      city: "Lyon",
      postalCode: "69001",
      phone: "04 00 00 00 00",
      email: "contact@atelier.example",
      website: "atelier.example",
      source: "Terrain",
      description: "Vitrine à refaire",
      contactFirstName: "Jeanne",
      contactLastName: "Martin",
      contactRole: "Gérante",
    });
    assert.deepEqual(parsed, {
      name: "Atelier Lumière",
      industry: "Fleuriste",
      address: "12 rue des Fleurs",
      city: "Lyon",
      postalCode: "69001",
      phone: "04 00 00 00 00",
      email: "contact@atelier.example",
      website: "https://atelier.example",
      instagram: null,
      linkedin: null,
      source: "Terrain",
      description: "Vitrine à refaire",
      contactFirstName: "Jeanne",
      contactLastName: "Martin",
      contactRole: "Gérante",
    });
  });

  it("re-parsing parsed output is idempotent (service re-validation)", () => {
    const once = createCompanySchema.parse({
      ...EMPTY_CREATE_FORM,
      name: "Maro Créa",
      instagram: "https://instagram.com/maro.crea/",
      website: "maro.example",
      linkedin: "linkedin.com/company/maro/",
    });
    assert.deepEqual(createCompanySchema.parse(once), once);
  });

  it("contact role without names asks for both names instead of dropping it", () => {
    const result = createCompanySchema.safeParse({
      ...EMPTY_CREATE_FORM,
      name: "Maro Créa",
      contactRole: "Fondatrice",
    });
    assert.equal(result.success, false);
    const messages = Object.fromEntries(
      (result.error?.issues ?? []).map((issue) => [String(issue.path[0]), issue.message]),
    );
    assert.equal(messages.contactFirstName, CONTACT_FIRST_NAME_REQUIRED_MESSAGE);
    assert.equal(messages.contactLastName, CONTACT_LAST_NAME_REQUIRED_MESSAGE);
  });
});

describe("updateCompanySchema", () => {
  const base = {
    ...EMPTY_CREATE_FORM,
    id: "co_maro",
    name: "Maro Créa",
    lifecycleStatus: "LEAD",
    priority: "NORMAL",
    contactPhone: "",
    contactEmail: "",
  };

  it("address is no longer required when editing", () => {
    const parsed = updateCompanySchema.parse(base);
    assert.equal(parsed.address, null);
    assert.equal(parsed.lifecycleStatus, "LEAD");
  });

  it("contact phone/email without names is rejected with a clear message", () => {
    const result = updateCompanySchema.safeParse({ ...base, contactPhone: "06 00 00 00 00" });
    assert.equal(result.success, false);
    const paths = (result.error?.issues ?? []).map((issue) => issue.path[0]);
    assert.ok(paths.includes("contactFirstName"));
    assert.ok(paths.includes("contactLastName"));
  });

  it("invalid contact email fails", () => {
    const result = updateCompanySchema.safeParse({
      ...base,
      contactFirstName: "Maro",
      contactLastName: "Dupont",
      contactEmail: "nope",
    });
    assert.equal(result.success, false);
    assert.ok(result.error?.issues.some((issue) => issue.path[0] === "contactEmail"));
  });
});
