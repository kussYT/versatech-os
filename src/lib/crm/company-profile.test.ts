import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMPANY_EDITABLE_FIELDS } from "./company-fields";
import { COMPANY_PROFILE_FIELDS, companyProfileCompleteness } from "./company-profile";

const EMPTY = {
  email: null,
  phone: null,
  website: null,
  address: null,
  city: null,
  postalCode: null,
  instagram: null,
  linkedin: null,
  industry: null,
  source: null,
};

describe("company profile completeness", () => {
  it("counts only the ten inline fiche fields", () => {
    assert.equal(COMPANY_PROFILE_FIELDS.length, 10);
    assert.equal(companyProfileCompleteness(EMPTY), 0);
    assert.equal(
      companyProfileCompleteness({
        ...EMPTY,
        email: "contact@marocrea.fr",
        phone: "06 00 00 00 00",
        instagram: "maro.crea",
        industry: "photographie",
        source: "Instagram",
        address: "12 rue des Lilas",
      }),
      60,
    );
  });

  it("ignores blank strings and does not count description", () => {
    assert.equal(companyProfileCompleteness({ ...EMPTY, city: "   " }), 0);
    assert.equal(COMPANY_EDITABLE_FIELDS.includes("description"), true);
    assert.equal((COMPANY_PROFILE_FIELDS as readonly string[]).includes("description"), false);
  });
});
