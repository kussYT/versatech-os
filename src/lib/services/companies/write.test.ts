import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import { signSensitiveIntent } from "@/lib/crm/sensitive-confirmation";
import { planCompanyGeocode } from "@/lib/prospection/geocode";
import {
  COMPANY_FIELD_UNKNOWN_MESSAGE,
  type UpdateCompanyFormInput,
} from "@/lib/validations/company";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  COMPANY_VALIDATION_MESSAGE,
  createCompany,
  updateCompany,
  updateCompanyField,
  type CompanyWriteStore,
  type CompanyWriteTx,
} from "./write";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};

type Row = Record<string, unknown> & { id: string };

function createStore(seed: {
  companies?: Row[];
  contacts?: Row[];
  opportunities?: Array<{ companyId: string; stage: string }>;
  quotes?: Array<{ companyId: string; status: string }>;
  projects?: Array<{ companyId: string }>;
} = {}) {
  const companies = new Map<string, Row>((seed.companies ?? []).map((row) => [row.id, { ...row }]));
  const contacts: Row[] = (seed.contacts ?? []).map((row) => ({ ...row }));
  const companyCreates: Row[] = [];
  const companyUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const contactCreates: Row[] = [];
  const contactUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const logs: Array<Record<string, unknown>> = [];
  let transactions = 0;
  let findReads = 0;

  const countWhere = <T extends Record<string, unknown>>(rows: T[], where: Record<string, unknown>) =>
    rows.filter((row) =>
      Object.entries(where).every(([key, expected]) => {
        if (expected && typeof expected === "object" && "in" in expected) {
          return (expected.in as unknown[]).includes(row[key]);
        }
        return row[key] === expected;
      }),
    ).length;

  const tx: CompanyWriteTx = {
    company: {
      findUnique: async ({ where }) => {
        findReads += 1;
        const row = companies.get(where.id);
        if (!row) {
          return null;
        }
        const primary = contacts
          .filter((contact) => contact.companyId === row.id)
          .sort((left, right) => Number(Boolean(right.isPrimary)) - Number(Boolean(left.isPrimary)));
        return {
          id: row.id,
          lifecycleStatus: row.lifecycleStatus as never,
          address: (row.address as string | null | undefined) ?? null,
          city: (row.city as string | null | undefined) ?? null,
          postalCode: (row.postalCode as string | null | undefined) ?? null,
          latitude: typeof row.latitude === "number" ? row.latitude : null,
          longitude: typeof row.longitude === "number" ? row.longitude : null,
          geocodeStatus:
            row.geocodeStatus === "OK" || row.geocodeStatus === "FAILED" || row.geocodeStatus === "MANUAL"
              ? row.geocodeStatus
              : null,
          contacts: primary.slice(0, 1).map((contact) => ({ id: contact.id })),
        };
      },
      create: async ({ data }) => {
        const row = { id: `co_${companyCreates.length + 1}`, ...data };
        companyCreates.push(row);
        companies.set(row.id, row);
        return { id: row.id, name: row.name };
      },
      update: async ({ where, data }) => {
        companyUpdates.push({ id: where.id, data });
        const row = companies.get(where.id);
        if (row) {
          Object.assign(row, data);
        }
        return row;
      },
    },
    contact: {
      create: async ({ data }) => {
        const row = { id: `ct_${contactCreates.length + 1}`, ...data };
        contactCreates.push(row);
        contacts.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        contactUpdates.push({ id: where.id, data });
        return data;
      },
    },
    opportunity: { count: async ({ where }) => countWhere(seed.opportunities ?? [], where) },
    quote: { count: async ({ where }) => countWhere(seed.quotes ?? [], where) },
    project: { count: async ({ where }) => countWhere(seed.projects ?? [], where) },
    activityLog: {
      create: async ({ data }) => {
        logs.push(data);
        return data;
      },
    },
  };

  const store: CompanyWriteStore = {
    $transaction: async (fn) => {
      transactions += 1;
      return fn(tx);
    },
  };

  return {
    store,
    companies,
    companyCreates,
    companyUpdates,
    contactCreates,
    contactUpdates,
    logs,
    get transactions() {
      return transactions;
    },
    get findReads() {
      return findReads;
    },
  };
}

/** `readString` shape for the create form. */
const EMPTY_FORM = {
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

const MARO_CREA = {
  ...EMPTY_FORM,
  name: "Maro Créa",
  instagram: "@maro.crea",
  industry: "photographie / communication / création de contenu",
  source: "Instagram",
  description: "site vitrine",
};

function editForm(
  overrides: Partial<UpdateCompanyFormInput> &
    Pick<UpdateCompanyFormInput, "id" | "name" | "lifecycleStatus">,
): UpdateCompanyFormInput {
  return {
    ...EMPTY_FORM,
    contactPhone: "",
    contactEmail: "",
    priority: "NORMAL",
    ...overrides,
  };
}

describe("CompanyWriteService.createCompany", () => {
  test("Maro Créa: 1 Company LEAD with instagram handle, no Contact, 1 company.created log", async () => {
    const env = createStore();
    const result = await createCompany(MARO_CREA, actor, { store: env.store });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { companyId: "co_1", name: "Maro Créa" });
    assert.equal(env.transactions, 1);
    assert.equal(env.companyCreates.length, 1);
    const created = env.companyCreates[0]!;
    assert.equal(created.lifecycleStatus, "LEAD");
    assert.equal(created.instagram, "maro.crea");
    assert.equal(created.linkedin, null);
    assert.equal(created.email, null);
    assert.equal(created.phone, null);
    assert.equal(created.address, null);
    assert.equal(created.industry, "photographie / communication / création de contenu");
    assert.equal(created.source, "Instagram");
    assert.equal(created.description, "site vitrine");
    assert.equal(created.priority, "NORMAL");
    assert.equal(created.country, "FR");
    assert.equal(env.contactCreates.length, 0);
    assert.deepEqual(env.logs, [
      {
        actorId: "user_1",
        entityType: "Company",
        entityId: "co_1",
        action: "company.created",
        metadata: { name: "Maro Créa" },
      },
    ]);
  });

  test("legacy full create still writes the primary contact", async () => {
    const env = createStore();
    const result = await createCompany(
      {
        ...EMPTY_FORM,
        name: "Atelier Lumière",
        address: "12 rue des Fleurs",
        city: "Lyon",
        contactFirstName: "Jeanne",
        contactLastName: "Martin",
        contactRole: "Gérante",
      },
      actor,
      { store: env.store },
    );
    assert.equal(result.ok, true);
    assert.equal(env.contactCreates.length, 1);
    assert.deepEqual(env.contactCreates[0], {
      id: "ct_1",
      companyId: "co_1",
      firstName: "Jeanne",
      lastName: "Martin",
      role: "Gérante",
      isPrimary: true,
    });
  });

  test("blank name is VALIDATION without any write", async () => {
    const env = createStore();
    const result = await createCompany({ ...EMPTY_FORM, name: "  " }, actor, { store: env.store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, COMPANY_VALIDATION_MESSAGE);
    assert.ok(result.fieldErrors?.name);
    assert.equal(env.transactions, 0);
    assert.equal(env.logs.length, 0);
  });

  test("missing actor is AUTH_REQUIRED without any write", async () => {
    const env = createStore();
    const result = await createCompany(MARO_CREA, { ...actor, id: "" }, { store: env.store });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "AUTH_REQUIRED");
    }
    assert.equal(env.transactions, 0);
  });
});

describe("CompanyWriteService.updateCompany", () => {
  test("adding an email later on a name-only company succeeds and logs company.updated", async () => {
    const env = createStore();
    const created = await createCompany(MARO_CREA, actor, { store: env.store });
    assert.equal(created.ok, true);

    const result = await updateCompany(
      editForm({
        id: "co_1",
        name: "Maro Créa",
        instagram: "maro.crea",
        lifecycleStatus: "LEAD",
        email: "hello@maro.example",
      }),
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { companyId: "co_1" });
    assert.equal(env.companies.get("co_1")?.email, "hello@maro.example");
    assert.equal(env.companies.get("co_1")?.instagram, "maro.crea");
    assert.equal(env.companies.get("co_1")?.lifecycleStatus, "LEAD");
    assert.equal(env.companyUpdates.length, 1);
    assert.equal("geocodeStatus" in (env.companyUpdates[0]?.data ?? {}), false);
    assert.equal(env.contactCreates.length, 0);
    const actions = env.logs.map((log) => log.action);
    assert.deepEqual(actions, ["company.created", "company.updated"]);
    assert.deepEqual(env.logs[1], {
      actorId: "user_1",
      entityType: "Company",
      entityId: "co_1",
      action: "company.updated",
      metadata: { name: "Maro Créa" },
    });
  });

  test("manual LEAD → CONTACTED goes through validateManualLifecycle and logs company.lifecycle_changed", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD" }],
    });
    const result = await updateCompany(
      editForm({ id: "co_maro", name: "Maro Créa", lifecycleStatus: "CONTACTED" }),
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    assert.equal(env.companies.get("co_maro")?.lifecycleStatus, "CONTACTED");
    assert.deepEqual(
      env.logs.map((log) => log.action),
      ["company.lifecycle_changed", "company.updated"],
    );
    assert.deepEqual(env.logs[0], {
      actorId: "user_1",
      entityType: "Company",
      entityId: "co_maro",
      action: "company.lifecycle_changed",
      metadata: { from: "LEAD", to: "CONTACTED", reason: "company.updated" },
    });
  });

  test("unjustified CLIENT is rejected with no write", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD" }],
    });
    const result = await updateCompany(
      editForm({ id: "co_maro", name: "Maro Créa", lifecycleStatus: "CLIENT" }),
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "VALIDATION");
    assert.equal(
      result.message,
      "Un client doit avoir une opportunité gagnée, un devis accepté ou un projet.",
    );
    assert.deepEqual(result.fieldErrors, { lifecycleStatus: [result.message] });
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.contactCreates.length + env.contactUpdates.length, 0);
    assert.equal(env.logs.length, 0);
    assert.equal(env.companies.get("co_maro")?.lifecycleStatus, "LEAD");
  });

  test("justified CLIENT still requires a server confirmation", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "QUALIFIED" }],
      projects: [{ companyId: "co_maro" }],
    });
    const refused = await updateCompany(
      editForm({ id: "co_maro", name: "Maro Créa", lifecycleStatus: "CLIENT" }),
      actor,
      { store: env.store, secret: "test-secret-at-least-32-characters", confirmationToken: "true" },
    );
    assert.equal(refused.ok, false);
    if (!refused.ok) {
      assert.equal(refused.code, "CONFIRMATION_REQUIRED");
    }
    assert.equal(env.companyUpdates.length, 0);

    const token = signSensitiveIntent(
      {
        kind: "company-lifecycle",
        actorId: actor.id,
        companyId: "co_maro",
        lifecycle: "CLIENT",
        exp: Date.now() + 60_000,
      },
      "test-secret-at-least-32-characters",
    );
    const result = await updateCompany(
      editForm({ id: "co_maro", name: "Maro Créa", lifecycleStatus: "CLIENT" }),
      actor,
      { store: env.store, secret: "test-secret-at-least-32-characters", confirmationToken: token },
    );
    assert.equal(result.ok, true);
    assert.equal(env.companies.get("co_maro")?.lifecycleStatus, "CLIENT");
  });

  test("unknown company is NOT_FOUND with no write", async () => {
    const env = createStore();
    const result = await updateCompany(
      editForm({ id: "co_missing", name: "X", lifecycleStatus: "LEAD" }),
      actor,
      { store: env.store },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NOT_FOUND");
      assert.equal(result.message, COMPANY_NOT_FOUND_MESSAGE);
    }
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.logs.length, 0);
  });

  test("legacy company with full data and a primary contact updates fine", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_atelier",
          name: "Atelier Lumière",
          lifecycleStatus: "CONTACTED",
          address: "12 rue des Fleurs",
          city: "Lyon",
        },
      ],
      contacts: [{ id: "ct_jeanne", companyId: "co_atelier", isPrimary: true }],
    });

    const result = await updateCompany(
      editForm({
        id: "co_atelier",
        name: "Atelier Lumière",
        lifecycleStatus: "CONTACTED",
        priority: "HIGH",
        industry: "Fleuriste",
        address: "12 rue des Fleurs",
        city: "Lyon",
        postalCode: "69001",
        phone: "04 00 00 00 00",
        email: "contact@atelier.example",
        website: "atelier.example",
        source: "Terrain",
        description: "Vitrine",
        contactFirstName: "Jeanne",
        contactLastName: "Martin",
        contactRole: "Gérante",
        contactPhone: "06 00 00 00 00",
        contactEmail: "jeanne@atelier.example",
      }),
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    assert.deepEqual(env.companyUpdates[0], {
      id: "co_atelier",
      data: {
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
        description: "Vitrine",
        priority: "HIGH",
      },
    });
    assert.equal(env.companyUpdates.length, 1);
    assert.deepEqual(env.contactUpdates, [
      {
        id: "ct_jeanne",
        data: {
          firstName: "Jeanne",
          lastName: "Martin",
          role: "Gérante",
          phone: "06 00 00 00 00",
          email: "jeanne@atelier.example",
          isPrimary: true,
        },
      },
    ]);
    assert.equal(env.contactCreates.length, 0);
    assert.deepEqual(env.logs.map((log) => log.action), ["company.updated"]);
  });

  test("full update that changes the postal code clears geocode status without a live geocode call", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_atelier",
          name: "Atelier Lumière",
          lifecycleStatus: "CONTACTED",
          address: "12 rue des Fleurs",
          city: "Lyon",
          geocodeStatus: "MANUAL",
        },
      ],
    });

    const result = await updateCompany(
      editForm({
        id: "co_atelier",
        name: "Atelier Lumière",
        lifecycleStatus: "CONTACTED",
        address: "12 rue des Fleurs",
        city: "Lyon",
        postalCode: "69001",
      }),
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    assert.equal(env.companyUpdates[0]?.data.geocodeStatus, null);
    assert.equal(env.companyUpdates[0]?.data.postalCode, "69001");
    assert.equal(env.companyUpdates[0]?.data.address, "12 rue des Fleurs");
    assert.equal(env.companies.get("co_atelier")?.geocodeStatus, null);
  });
});

describe("CompanyWriteService.updateCompanyField", () => {
  test("Maro Créa null email → contact@marocrea.fr writes only the email column and an audit log", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          email: null,
          phone: "06 00 00 00 00",
          geocodeStatus: "MANUAL",
        },
      ],
    });

    const result = await updateCompanyField(
      "co_maro",
      "email",
      "contact@marocrea.fr",
      actor,
      { store: env.store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, { companyId: "co_maro", savedValue: "contact@marocrea.fr" });
    assert.deepEqual(env.companyUpdates, [
      { id: "co_maro", data: { email: "contact@marocrea.fr" } },
    ]);
    assert.equal(env.companies.get("co_maro")?.phone, "06 00 00 00 00");
    assert.equal(env.companies.get("co_maro")?.geocodeStatus, "MANUAL");
    assert.deepEqual(env.logs, [
      {
        actorId: "user_1",
        entityType: "Company",
        entityId: "co_maro",
        action: "company.updated",
        metadata: { field: "email" },
      },
    ]);
    assert.equal(env.transactions, 1);
  });

  test("a company with email, phone, instagram and address updates phone only", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          email: "contact@marocrea.fr",
          phone: "06 00 00 00 00",
          instagram: "maro.crea",
          address: "12 rue des Lilas",
          geocodeStatus: "OK",
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "phone", "07 11 22 33 44", actor, {
      store: env.store,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(env.companyUpdates, [{ id: "co_maro", data: { phone: "07 11 22 33 44" } }]);
    assert.equal(env.companies.get("co_maro")?.email, "contact@marocrea.fr");
    assert.equal(env.companies.get("co_maro")?.instagram, "maro.crea");
    assert.equal(env.companies.get("co_maro")?.address, "12 rue des Lilas");
    assert.equal(env.companies.get("co_maro")?.geocodeStatus, "OK");
    assert.deepEqual(env.logs[0]?.metadata, { field: "phone" });
  });

  test("an explicit empty email stores null and nothing else", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          email: "contact@marocrea.fr",
          phone: "06 00 00 00 00",
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "email", "", actor, { store: env.store });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.savedValue, null);
    assert.deepEqual(env.companyUpdates, [{ id: "co_maro", data: { email: null } }]);
    assert.equal(env.companies.get("co_maro")?.email, null);
    assert.equal(env.companies.get("co_maro")?.phone, "06 00 00 00 00");
  });

  test("instagram @maro.crea is stored as maro.crea", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD", instagram: null }],
    });

    const result = await updateCompanyField("co_maro", "instagram", "@maro.crea", actor, {
      store: env.store,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.savedValue, "maro.crea");
    assert.deepEqual(env.companyUpdates, [{ id: "co_maro", data: { instagram: "maro.crea" } }]);
  });

  test("an invalid email is rejected with no write and the previous value untouched", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          email: "contact@marocrea.fr",
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "email", "pas-un-email", actor, {
      store: env.store,
    });

    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, COMPANY_VALIDATION_MESSAGE);
    assert.deepEqual(result.fieldErrors?.email, ["E-mail invalide"]);
    assert.equal(env.transactions, 0);
    assert.equal(env.findReads, 0);
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.logs.length, 0);
    assert.equal(env.companies.get("co_maro")?.email, "contact@marocrea.fr");
  });

  test("setting an address saves it and clears MANUAL so the existing batch can geocode", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          address: null,
          city: null,
          postalCode: null,
          geocodeStatus: "MANUAL",
          latitude: null,
          longitude: null,
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "address", "12 rue des Lilas", actor, {
      store: env.store,
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.savedValue, "12 rue des Lilas");
    assert.deepEqual(env.companyUpdates, [
      {
        id: "co_maro",
        data: { address: "12 rue des Lilas", geocodeStatus: null },
      },
    ]);
    assert.equal(env.logs[0]?.action, "company.updated");
    const plan = planCompanyGeocode({
      id: "co_maro",
      name: "Maro Créa",
      address: "12 rue des Lilas",
      postalCode: null,
      city: null,
      country: "FR",
      latitude: null,
      longitude: null,
      geocodedAddress: null,
      geocodeStatus: null,
    });
    assert.equal(plan.action, "fetch");
    const source = readFileSync(path.join(process.cwd(), "src/lib/services/companies/write.ts"), "utf8");
    assert.equal(source.includes("fetchNominatimHit"), false);
    assert.equal(source.includes("geocodeCompany"), false);
  });

  test("an unchanged address does not clear a MANUAL geocode status", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          address: "12 rue des Lilas",
          geocodeStatus: "MANUAL",
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "address", "12 rue des Lilas", actor, {
      store: env.store,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(env.companyUpdates, [
      { id: "co_maro", data: { address: "12 rue des Lilas" } },
    ]);
    assert.equal(env.companies.get("co_maro")?.geocodeStatus, "MANUAL");
  });

  test("an address change keeps geocode status when the company already has coordinates", async () => {
    const env = createStore({
      companies: [
        {
          id: "co_maro",
          name: "Maro Créa",
          lifecycleStatus: "LEAD",
          address: "12 rue des Lilas",
          latitude: 50.35,
          longitude: 3.52,
          geocodeStatus: "OK",
        },
      ],
    });

    const result = await updateCompanyField("co_maro", "address", "99 rue Nouvelle", actor, {
      store: env.store,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(env.companyUpdates, [
      { id: "co_maro", data: { address: "99 rue Nouvelle" } },
    ]);
    assert.equal(env.companies.get("co_maro")?.geocodeStatus, "OK");
    assert.equal(env.companies.get("co_maro")?.latitude, 50.35);
  });

  test("a linkedin URL is normalised and a non-linkedin URL is rejected", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD", linkedin: null }],
    });

    const saved = await updateCompanyField(
      "co_maro",
      "linkedin",
      "https://www.linkedin.com/company/maro-crea/",
      actor,
      { store: env.store },
    );
    assert.equal(saved.ok, true);
    if (!saved.ok) {
      return;
    }
    assert.equal(saved.data.savedValue, "https://www.linkedin.com/company/maro-crea");
    assert.deepEqual(env.companyUpdates, [
      { id: "co_maro", data: { linkedin: "https://www.linkedin.com/company/maro-crea" } },
    ]);

    const rejected = await updateCompanyField(
      "co_maro",
      "linkedin",
      "https://example.com/maro",
      actor,
      { store: env.store },
    );
    assert.equal(rejected.ok, false);
    if (rejected.ok) {
      return;
    }
    assert.equal(rejected.code, "VALIDATION");
    assert.ok(rejected.fieldErrors?.linkedin?.[0]);
    assert.equal(env.companyUpdates.length, 1);
    assert.equal(env.companies.get("co_maro")?.linkedin, "https://www.linkedin.com/company/maro-crea");
  });

  test("an unknown field is rejected before any read", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD" }],
    });

    for (const field of ["lifecycleStatus", "priority", "name", "foo"]) {
      const result = await updateCompanyField("co_maro", field, "LEAD", actor, { store: env.store });
      assert.equal(result.ok, false, field);
      if (!result.ok) {
        assert.equal(result.code, "VALIDATION");
        assert.equal(result.message, COMPANY_FIELD_UNKNOWN_MESSAGE);
      }
    }

    assert.equal(env.transactions, 0);
    assert.equal(env.findReads, 0);
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.logs.length, 0);
  });

  test("a missing company is NOT_FOUND with no write", async () => {
    const env = createStore();
    const result = await updateCompanyField("co_missing", "email", "contact@marocrea.fr", actor, {
      store: env.store,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "NOT_FOUND");
      assert.equal(result.message, COMPANY_NOT_FOUND_MESSAGE);
    }
    assert.equal(env.transactions, 1);
    assert.equal(env.findReads, 1);
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.logs.length, 0);
  });

  test("a missing actor is rejected before any read", async () => {
    const env = createStore({
      companies: [{ id: "co_maro", name: "Maro Créa", lifecycleStatus: "LEAD", email: null }],
    });

    const result = await updateCompanyField(
      "co_maro",
      "email",
      "contact@marocrea.fr",
      { ...actor, id: "" },
      { store: env.store },
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "AUTH_REQUIRED");
    }
    assert.equal(env.transactions, 0);
    assert.equal(env.findReads, 0);
    assert.equal(env.companyUpdates.length, 0);
    assert.equal(env.companies.get("co_maro")?.email, null);
  });
});
