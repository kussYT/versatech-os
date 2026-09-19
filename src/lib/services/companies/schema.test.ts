import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ZERO_MONEY } from "@/lib/money";
import { mapCompanyCompact, mapCompanySearch } from "./map";
import {
  COMPANY_COMPACT_LIMITS,
  SEARCH_COMPANIES_LIMITS,
  assertCompanyCompact,
  companyCompactSchema,
  companySearchHitSchema,
  companySearchSchema,
  emptyCompanySearch,
  getCompanyInputSchema,
  isPlainJsonValue,
  parseCompanyCompact,
  parseSearchCompaniesInput,
  requireServiceActor,
  searchCompaniesInputSchema,
  serializeCompanyCompact,
  truncateUntrustedText,
  type CompanyCompact,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

const emptyFinance = {
  signed: ZERO_MONEY,
  collected: ZERO_MONEY,
  remaining: ZERO_MONEY,
  pending: ZERO_MONEY,
  overdue: ZERO_MONEY,
  pendingCount: 0,
  overdueCount: 0,
  paidCount: 0,
  paymentCount: 0,
};

function sampleCompact(overrides: Partial<CompanyCompact> = {}): CompanyCompact {
  return parseCompanyCompact({
    id: "co_atelier",
    name: "Atelier Nord",
    lifecycleStatus: "LEAD",
    industry: "Menuiserie",
    website: "https://atelier-nord.example",
    phone: "0472000000",
    email: "contact@atelier-nord.example",
    address: "12 rue des Fleurs",
    city: "Lyon",
    postalCode: "69001",
    country: "FR",
    source: "terrain",
    priority: "HIGH",
    geocodeStatus: "OK",
    description: { text: "Atelier local.", truncated: false },
    isClient: false,
    primaryContact: { firstName: "Léa", lastName: "Martin", role: "Gérante" },
    contacts: [
      {
        id: "ct_1",
        firstName: "Léa",
        lastName: "Martin",
        role: "Gérante",
        phone: "0600000000",
        email: "lea@atelier-nord.example",
        isPrimary: true,
      },
    ],
    lastInteraction: {
      id: "int_1",
      type: "CALL",
      direction: "OUTBOUND",
      result: "CALLBACK",
      subject: { text: "Premier appel", truncated: false },
      notes: { text: "Rappeler jeudi.", truncated: false },
      occurredAt: "2026-09-18T14:00:00.000Z",
    },
    nextFollowUp: {
      id: "fu_1",
      title: "Relance devis",
      dueAt: "2026-09-19T07:00:00.000Z",
      status: "PENDING",
    },
    hasOpenOpportunity: true,
    openOpportunities: [
      {
        id: "opp_1",
        title: "Site vitrine",
        stage: "QUOTE",
        estimatedValue: "4500.00",
        updatedAt: "2026-09-17T10:00:00.000Z",
      },
    ],
    principalProject: {
      id: "proj_1",
      name: "Site vitrine",
      status: "ACTIVE",
      source: "in_development",
    },
    websitePresence: {
      status: "IN_DEVELOPMENT",
      url: "https://atelier-nord.example",
      host: "atelier-nord.example",
    },
    finance: {
      signed: ZERO_MONEY,
      collected: ZERO_MONEY,
      remaining: ZERO_MONEY,
      overdueCount: 0,
    },
    commercialBrief: {
      verificationStatus: "UNVERIFIED",
      digitalPresence: { text: "Instagram @atelier", truncated: false },
      strengths: null,
      opportunities: null,
      proposal: null,
      angle: null,
    },
    ...overrides,
  });
}

describe("CompanyService searchCompanies schema", () => {
  test("empty result is valid", () => {
    const empty = emptyCompanySearch("atelier");
    assert.equal(empty.total, 0);
    assert.deepEqual(empty.items, []);
    assert.equal(companySearchSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip of a hit without href", () => {
    const dto = {
      query: "atelier",
      total: 1,
      items: [
        {
          id: "co_atelier",
          name: "Atelier Nord",
          lifecycleStatus: "LEAD" as const,
          city: "Lyon",
          industry: "Menuiserie",
          primaryContact: { firstName: "Léa", lastName: "Martin", role: "Gérante" },
        },
      ],
    };
    const parsed = companySearchSchema.parse(dto);
    assert.deepEqual(JSON.parse(JSON.stringify(parsed)), parsed);
    assert.equal(JSON.stringify(parsed).includes('"href"'), false);
  });

  test("limit default 10 max 20; oversized items fail", () => {
    assert.equal(SEARCH_COMPANIES_LIMITS.default, 10);
    assert.equal(SEARCH_COMPANIES_LIMITS.max, 20);
    assert.equal(parseSearchCompaniesInput({ query: "atelier" }).limit, 10);
    assert.equal(searchCompaniesInputSchema.safeParse({ query: "atelier", limit: 21 }).success, false);
    assert.equal(searchCompaniesInputSchema.safeParse({ query: "x" }).success, false);
    assert.equal(searchCompaniesInputSchema.safeParse({ query: "" }).success, false);

    const tooMany = {
      query: "atelier",
      total: 21,
      items: Array.from({ length: 21 }, (_, index) => ({
        id: `co_${index}`,
        name: `Boite ${index}`,
        lifecycleStatus: "LEAD" as const,
        city: null,
        industry: null,
        primaryContact: null,
      })),
    };
    assert.equal(companySearchSchema.safeParse(tooMany).success, false);
  });

  test("href on a search hit is rejected", () => {
    assert.equal(
      companySearchHitSchema.safeParse({
        id: "co_1",
        name: "Atelier",
        lifecycleStatus: "LEAD",
        city: null,
        industry: null,
        primaryContact: null,
        href: "/entreprises/co_1",
      }).success,
      false,
    );
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});

describe("CompanyService getCompany compact schema", () => {
  test("sample compact JSON roundtrips without Date/Decimal", () => {
    const sample = sampleCompact();
    const roundtrip = JSON.parse(JSON.stringify(sample)) as unknown;
    assert.deepEqual(roundtrip, sample);
    assert.deepEqual(parseCompanyCompact(roundtrip), sample);
    assert.equal(isPlainJsonValue(sample), true);
  });

  test("serializeCompanyCompact emits parseable JSON without hub dumps or secrets", () => {
    const json = serializeCompanyCompact(sampleCompact());
    assert.equal(json.includes('"quotes"'), false);
    assert.equal(json.includes('"payments"'), false);
    assert.equal(json.includes('"documents"'), false);
    assert.equal(json.includes('"journey"'), false);
    assert.equal(json.includes('"allowedLifecycleStatuses"'), false);
    assert.equal(json.includes('"maintenanceContracts"'), false);
    assert.equal(json.includes('"interactions"'), false);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes("passwordHash"), false);
    assert.equal(json.includes("DATABASE_URL"), false);
    assert.equal(json.includes("AUTH_SECRET"), false);
    assertCompanyCompact(JSON.parse(json));
  });

  test("hub-only dumps are rejected (quotes, history, journey)", () => {
    const sample = sampleCompact();
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        quotes: [{ id: "q1", reference: "DEV-2026-001", amountIncTax: "100.00" }],
      }).success,
      false,
    );
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        interactions: Array.from({ length: 40 }, (_, index) => ({ id: `int_${index}` })),
      }).success,
      false,
    );
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        journey: { steps: [] },
        allowedLifecycleStatuses: ["LEAD", "CLIENT"],
        documents: [{ id: "doc_1" }],
        payments: [{ id: "pay_1" }],
      }).success,
      false,
    );
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        commercialBrief: { digitalPresence: "x", extraDump: { foo: 1 } },
      }).success,
      false,
    );
  });

  test("contacts and open opportunities are bounded", () => {
    const sample = sampleCompact();
    const tooManyContacts = {
      ...sample,
      contacts: Array.from({ length: COMPANY_COMPACT_LIMITS.contacts + 1 }, (_, index) => ({
        id: `ct_${index}`,
        firstName: "A",
        lastName: "B",
        role: null,
        phone: null,
        email: null,
        isPrimary: index === 0,
      })),
    };
    assert.equal(companyCompactSchema.safeParse(tooManyContacts).success, false);

    const tooManyOpps = {
      ...sample,
      openOpportunities: Array.from(
        { length: COMPANY_COMPACT_LIMITS.openOpportunities + 1 },
        (_, index) => ({
          id: `opp_${index}`,
          title: "Opp",
          stage: "TO_QUALIFY" as const,
          estimatedValue: "10.00",
          updatedAt: "2026-09-17T10:00:00.000Z",
        }),
      ),
    };
    assert.equal(companyCompactSchema.safeParse(tooManyOpps).success, false);
  });

  test("money is canonical string; Decimal-like and floats fail", () => {
    const sample = sampleCompact();
    assert.equal(typeof sample.openOpportunities[0]?.estimatedValue, "string");
    assert.equal(sample.finance.signed, ZERO_MONEY);
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        openOpportunities: [{ ...sample.openOpportunities[0]!, estimatedValue: 4500 }],
      }).success,
      false,
    );
    assert.equal(
      companyCompactSchema.safeParse({
        ...sample,
        finance: { ...sample.finance, signed: { s: 1, e: 2, d: [100] } },
      }).success,
      false,
    );
  });

  test("truncateUntrustedText caps at 400 and flags truncated", () => {
    const long = "é".repeat(COMPANY_COMPACT_LIMITS.untrustedText + 20);
    const truncated = truncateUntrustedText(long);
    assert.ok(truncated);
    assert.equal(truncated.truncated, true);
    assert.equal(truncated.text.length, COMPANY_COMPACT_LIMITS.untrustedText);
    assert.equal(truncateUntrustedText("  "), null);
    assert.equal(truncateUntrustedText(null), null);
  });

  test("getCompany input schema requires companyId; missing actor is rejected", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.equal(getCompanyInputSchema.safeParse({}).success, false);
    assert.equal(getCompanyInputSchema.safeParse({ companyId: "" }).success, false);
  });
});

describe("mapCompanyCompact + mapCompanySearch", () => {
  test("empty loaded company never invents LIVE, client flag, or brief", () => {
    const mapped = mapCompanyCompact(
      {
        id: "co_empty",
        name: "Prospect",
        lifecycleStatus: "LEAD",
        industry: null,
        website: null,
        phone: null,
        email: null,
        address: null,
        city: null,
        postalCode: null,
        country: "FR",
        source: null,
        priority: "NORMAL",
        description: null,
        commercialBrief: null,
        geocodeStatus: null,
        contacts: [],
        lastInteraction: null,
        nextFollowUp: null,
        openOpportunities: [],
        projects: [],
        maintenanceContracts: [],
      },
      emptyFinance,
      new Date("2026-09-19T09:00:00.000Z"),
    );

    assert.equal(mapped.isClient, false);
    assert.equal(mapped.websitePresence.status, "NO_WEBSITE");
    assert.notEqual(mapped.websitePresence.status, "LIVE");
    assert.equal(mapped.principalProject, null);
    assert.equal(mapped.commercialBrief, null);
    assert.equal(mapped.hasOpenOpportunity, false);
    assert.deepEqual(mapped.openOpportunities, []);
    assert.equal(mapped.finance.signed, ZERO_MONEY);
    assert.equal(JSON.stringify(mapped).includes('"quotes"'), false);
  });

  test("website URL without project is not invented LIVE; COMPLETED uses helper LIVE", () => {
    const urlOnly = mapCompanyCompact(
      {
        id: "co_url",
        name: "Avec URL",
        lifecycleStatus: "CONTACTED",
        industry: null,
        website: "https://www.atelier.test",
        phone: null,
        email: null,
        address: null,
        city: "Lyon",
        postalCode: null,
        country: "FR",
        source: null,
        priority: "NORMAL",
        description: null,
        commercialBrief: {},
        geocodeStatus: null,
        contacts: [],
        lastInteraction: null,
        nextFollowUp: null,
        openOpportunities: [],
        projects: [],
        maintenanceContracts: [],
      },
      emptyFinance,
      new Date("2026-09-19T09:00:00.000Z"),
    );
    assert.equal(urlOnly.websitePresence.status, null);
    assert.equal(urlOnly.websitePresence.host, "atelier.test");
    assert.notEqual(urlOnly.websitePresence.status, "LIVE");

    const live = mapCompanyCompact(
      {
        id: "co_live",
        name: "Client site",
        lifecycleStatus: "CLIENT",
        industry: null,
        website: "https://www.atelier.test",
        phone: null,
        email: null,
        address: null,
        city: "Lyon",
        postalCode: null,
        country: "FR",
        source: null,
        priority: "NORMAL",
        description: null,
        commercialBrief: null,
        geocodeStatus: null,
        contacts: [],
        lastInteraction: null,
        nextFollowUp: null,
        openOpportunities: [],
        projects: [
          {
            id: "proj_done",
            name: "Site",
            status: "COMPLETED",
            startDate: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-06-01T10:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-06-01T10:00:00.000Z",
          },
        ],
        maintenanceContracts: [],
      },
      emptyFinance,
      new Date("2026-09-19T09:00:00.000Z"),
    );
    assert.equal(live.isClient, true);
    assert.equal(live.websitePresence.status, "LIVE");
    assert.equal(live.principalProject?.status, "COMPLETED");
    assert.equal(live.principalProject?.source, "completed");
  });

  test("brief is parsed via parseCommercialBrief, truncated, never raw JSON dump", () => {
    const huge = "x".repeat(500);
    const mapped = mapCompanyCompact(
      {
        id: "co_brief",
        name: "Brief Co",
        lifecycleStatus: "QUALIFIED",
        industry: null,
        website: null,
        phone: null,
        email: null,
        address: null,
        city: null,
        postalCode: null,
        country: "FR",
        source: null,
        priority: "NORMAL",
        description: huge,
        commercialBrief: {
          digitalPresence: huge,
          strengths: "Accueil",
          opportunities: "",
          proposal: "",
          angle: "",
          verificationStatus: "bogus",
          nestedDump: { ignore: true, sql: "DROP" },
        },
        geocodeStatus: null,
        contacts: [],
        lastInteraction: {
          id: "int_note",
          type: "NOTE",
          direction: "INTERNAL",
          result: null,
          subject: null,
          notes: huge,
          occurredAt: "2026-09-18T14:00:00.000Z",
        },
        nextFollowUp: null,
        openOpportunities: [
          {
            id: "opp_1",
            title: "Opp",
            stage: "TO_QUALIFY",
            estimatedValue: "12.5",
            updatedAt: "2026-09-17T10:00:00.000Z",
          },
        ],
        projects: [],
        maintenanceContracts: [],
      },
      {
        ...emptyFinance,
        signed: "12.00",
        remaining: "12.00",
      },
      new Date("2026-09-19T09:00:00.000Z"),
    );

    assert.equal(mapped.commercialBrief?.verificationStatus, "UNVERIFIED");
    assert.equal(mapped.commercialBrief?.digitalPresence?.truncated, true);
    assert.equal(mapped.commercialBrief?.digitalPresence?.text.length, 400);
    assert.equal(mapped.commercialBrief?.strengths?.text, "Accueil");
    assert.equal(mapped.description?.truncated, true);
    assert.equal(mapped.lastInteraction?.notes?.truncated, true);
    assert.equal(mapped.openOpportunities[0]?.estimatedValue, "12.50");
    const json = JSON.stringify(mapped);
    assert.equal(json.includes("nestedDump"), false);
    assert.equal(json.includes("DROP"), false);
  });

  test("mapCompanySearch projects loader rows without href", () => {
    const dto = mapCompanySearch(
      [
        {
          id: "co_1",
          name: "Atelier Nord",
          city: "Lyon",
          industry: "Menuiserie",
          lifecycleStatus: "LEAD",
          contacts: [{ firstName: "Léa", lastName: "Martin", role: "Gérante", isPrimary: true }],
        },
      ],
      "atelier",
      10,
    );
    assert.equal(dto.total, 1);
    assert.equal(dto.items[0]?.lifecycleStatus, "LEAD");
    assert.equal(dto.items[0]?.primaryContact?.firstName, "Léa");
    assert.equal(JSON.stringify(dto).includes('"href"'), false);
  });
});
