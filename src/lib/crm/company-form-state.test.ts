import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  editCompanyFormState,
  emptyProspectForm,
  patchCompanyForm,
} from "./company-form-state";

describe("prospect form state survives a failed submit", () => {
  it("keeps disclosure fields when another field changes", () => {
    let form = emptyProspectForm();
    form = patchCompanyForm(form, "name", "Maro Créa");
    form = patchCompanyForm(form, "instagram", "@maro.crea");
    form = patchCompanyForm(form, "address", "12 rue des Lilas");
    form = patchCompanyForm(form, "email", "pas-un-email");
    form = patchCompanyForm(form, "contactFirstName", "Jeanne");

    assert.equal(form.name, "Maro Créa");
    assert.equal(form.instagram, "@maro.crea");
    assert.equal(form.address, "12 rue des Lilas");
    assert.equal(form.email, "pas-un-email");
    assert.equal(form.contactFirstName, "Jeanne");
    assert.equal(form.city, "");
    assert.equal(form.linkedin, "");
  });

  it("does not share state between two empty forms", () => {
    const first = emptyProspectForm();
    const second = patchCompanyForm(first, "name", "Studio Nord");
    assert.equal(first.name, "");
    assert.equal(second.name, "Studio Nord");
  });
});

describe("edit company form state", () => {
  it("prefixes a stored instagram handle and keeps an empty disclosure field", () => {
    const form = editCompanyFormState({
      name: "Maro Créa",
      lifecycleStatus: "LEAD",
      priority: "NORMAL",
      industry: "photographie",
      address: null,
      city: "Lyon",
      postalCode: null,
      phone: null,
      email: "contact@marocrea.fr",
      website: null,
      instagram: "maro.crea",
      linkedin: "https://www.linkedin.com/company/maro-crea",
      source: "Instagram",
      description: null,
      contacts: [
        {
          firstName: "Jeanne",
          lastName: "Martin",
          role: null,
          phone: "06 00 00 00 00",
          email: null,
        },
      ],
    });

    assert.equal(form.instagram, "@maro.crea");
    assert.equal(form.address, "");
    assert.equal(form.city, "Lyon");
    assert.equal(form.email, "contact@marocrea.fr");
    assert.equal(form.contactFirstName, "Jeanne");
    assert.equal(form.contactPhone, "06 00 00 00 00");
    assert.equal(form.contactEmail, "");

    const afterError = patchCompanyForm(form, "email", "pas-un-email");
    assert.equal(afterError.email, "pas-un-email");
    assert.equal(afterError.instagram, "@maro.crea");
    assert.equal(afterError.address, "");
    assert.equal(form.email, "contact@marocrea.fr");
  });
});
