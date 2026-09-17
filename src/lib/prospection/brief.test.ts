import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCompanySchema } from "@/lib/validations/company";
import {
  EMPTY_COMMERCIAL_BRIEF,
  parseCommercialBrief,
  serializeCommercialBrief,
} from "./brief";
import { externalItineraryUrl } from "./itinerary";
import { prospectionTourIntent } from "./tour-intent";
import { VISIT_INTERACTION_TYPE, buildVisitInteractionFields } from "./visit";

describe("quick create validation", () => {
  it("requires name and address", () => {
    const missingAddress = createCompanySchema.safeParse({
      name: "Atelier Lumière",
      address: "",
      industry: "",
      city: "",
      postalCode: "",
      phone: "",
      email: "",
      website: "",
      source: "",
      description: "",
      contactFirstName: "",
      contactLastName: "",
      contactRole: "",
    });
    assert.equal(missingAddress.success, false);

    const ok = createCompanySchema.safeParse({
      name: "Atelier Lumière",
      address: "12 rue des Fleurs",
      industry: "Fleuriste",
      city: "Lyon",
      postalCode: "69001",
      phone: "",
      email: "",
      website: "",
      source: "",
      description: "",
      contactFirstName: "",
      contactLastName: "",
      contactRole: "",
    });
    assert.equal(ok.success, true);
  });

  it("keeps optional CRM fields optional", () => {
    const parsed = createCompanySchema.parse({
      name: "Studio Nord",
      address: "1 place Bellecour",
      industry: "",
      city: "",
      postalCode: "",
      phone: "",
      email: "",
      website: "",
      source: "",
      description: "",
      contactFirstName: "",
      contactLastName: "",
      contactRole: "",
    });
    assert.equal(parsed.industry, null);
    assert.equal(parsed.phone, null);
  });
});

describe("commercial brief", () => {
  it("parses empty / unknown as empty groups", () => {
    assert.deepEqual(parseCommercialBrief(null), EMPTY_COMMERCIAL_BRIEF);
    assert.deepEqual(parseCommercialBrief({}), EMPTY_COMMERCIAL_BRIEF);
  });

  it("serializes grouped fields without inventing facts", () => {
    const saved = serializeCommercialBrief({
      digitalPresence: "  Instagram @studio  ",
      strengths: "Accueil",
      opportunities: "",
      proposal: "Site vitrine",
      angle: "Prise de RDV",
      verificationStatus: "PARTIAL",
    });
    assert.equal(saved.digitalPresence, "Instagram @studio");
    assert.equal(saved.opportunities, "");
    assert.equal(saved.verificationStatus, "PARTIAL");
  });
});

describe("terrain helpers", () => {
  it("builds a MEETING interaction payload for a visit", () => {
    const payload = buildVisitInteractionFields("co_1", new Date("2026-09-16T10:00:00.000Z"));
    assert.equal(payload.type, VISIT_INTERACTION_TYPE);
    assert.equal(payload.companyId, "co_1");
    assert.equal(payload.direction, "INTERNAL");
    assert.equal(payload.notes, "Visite terrain");
    assert.equal(payload.result, "OTHER");
    assert.match(payload.occurredAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it("builds itinerary URL and tour intent", () => {
    const url = externalItineraryUrl({
      name: "Atelier",
      address: "12 rue des Fleurs",
      city: "Lyon",
      postalCode: "69001",
      country: "FR",
    });
    assert.match(url, /openstreetmap\.org\/search/);
    assert.equal(prospectionTourIntent("co_1").href, "/tournee?add=co_1");
  });
});
