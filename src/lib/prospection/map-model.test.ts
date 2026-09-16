import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompanyLifecycle } from "@/generated/prisma/client";
import {
  filterMapCompanies,
  hasUsableCoordinates,
  markerColorForLifecycle,
  needsLocation,
  plottableCompanies,
  type MapCompany,
} from "./map-model";

function company(overrides: Partial<MapCompany> & Pick<MapCompany, "id" | "name">): MapCompany {
  return {
    lifecycleStatus: "LEAD",
    industry: "Web",
    website: null,
    address: "12 rue Test",
    city: "Lyon",
    postalCode: "69001",
    country: "FR",
    latitude: null,
    longitude: null,
    nextFollowUpTitle: null,
    nextFollowUpAt: null,
    ...overrides,
  };
}

describe("marker colors from CRM lifecycle", () => {
  const expected: Record<CompanyLifecycle, string> = {
    LEAD: "blue",
    CONTACTED: "orange",
    QUALIFIED: "orange",
    OPPORTUNITY: "orange",
    CLIENT: "green",
    LOST: "red",
    INACTIVE: "gray",
  };

  for (const [status, color] of Object.entries(expected)) {
    it(`${status} → ${color}`, () => {
      assert.equal(markerColorForLifecycle(status as CompanyLifecycle), color);
    });
  }
});

describe("coordinates", () => {
  it("does not plot a company without coords", () => {
    const row = company({ id: "1", name: "Sans GPS" });
    assert.equal(hasUsableCoordinates(row), false);
    assert.equal(needsLocation(row), true);
    assert.deepEqual(plottableCompanies([row]), []);
  });

  it("plots a company with finite lat/lng", () => {
    const row = company({ id: "2", name: "Avec GPS", latitude: 45.76, longitude: 4.84 });
    assert.equal(hasUsableCoordinates(row), true);
    assert.equal(needsLocation(row), false);
    assert.equal(plottableCompanies([row]).length, 1);
  });
});

describe("map filters", () => {
  const rows: MapCompany[] = [
    company({ id: "lead", name: "Lead Alpha", lifecycleStatus: "LEAD", city: "Lyon" }),
    company({
      id: "mid",
      name: "Studio Contact",
      lifecycleStatus: "CONTACTED",
      city: "Paris",
    }),
    company({ id: "cli", name: "Client Vert", lifecycleStatus: "CLIENT", city: "Lyon" }),
    company({ id: "lost", name: "Perdu", lifecycleStatus: "LOST", city: "Nice" }),
    company({ id: "off", name: "Inactif", lifecycleStatus: "INACTIVE", city: "Lille" }),
  ];

  it("Tous returns everyone", () => {
    assert.equal(filterMapCompanies(rows, { filter: "all" }).length, 5);
  });

  it("À prospecter keeps LEAD only", () => {
    assert.deepEqual(
      filterMapCompanies(rows, { filter: "to_prospect" }).map((row) => row.id),
      ["lead"],
    );
  });

  it("En cours keeps CONTACTED/QUALIFIED/OPPORTUNITY", () => {
    assert.deepEqual(
      filterMapCompanies(rows, { filter: "in_progress" }).map((row) => row.id),
      ["mid"],
    );
  });

  it("Clients / Perdus / Inactifs", () => {
    assert.equal(filterMapCompanies(rows, { filter: "clients" })[0]?.id, "cli");
    assert.equal(filterMapCompanies(rows, { filter: "lost" })[0]?.id, "lost");
    assert.equal(filterMapCompanies(rows, { filter: "inactive" })[0]?.id, "off");
  });

  it("filters by company name and city", () => {
    const named = filterMapCompanies(rows, { filter: "all", query: "studio" });
    assert.deepEqual(
      named.map((row) => row.id),
      ["mid"],
    );
    const city = filterMapCompanies(rows, { filter: "all", city: "lyon" });
    assert.deepEqual(
      city.map((row) => row.id),
      ["lead", "cli"],
    );
  });

  it("À visiter aujourd'hui uses remaining tour ids only", () => {
    const five: MapCompany[] = [
      company({ id: "s1", name: "Stop 1" }),
      company({ id: "s2", name: "Stop 2" }),
      company({ id: "s3", name: "Stop 3" }),
      company({ id: "s4", name: "Stop 4" }),
      company({ id: "s5", name: "Stop 5" }),
    ];
    const remaining = filterMapCompanies(five, {
      filter: "today_visits",
      todayVisitIds: ["s2", "s4", "s5"],
    });
    assert.deepEqual(
      remaining.map((row) => row.id),
      ["s2", "s4", "s5"],
    );
  });

  it("empty todayVisitIds shows nobody, including when no tour exists", () => {
    assert.equal(
      filterMapCompanies(rows, { filter: "today_visits", todayVisitIds: [] }).length,
      0,
    );
  });
});
