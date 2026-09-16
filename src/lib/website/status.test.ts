import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import type { MaintenanceStatus, ProjectStatus } from "@/generated/prisma/client";
import { buildWebsiteStatus, type WebsiteContractInput, type WebsiteProjectInput } from "./status";

const now = fromParisDateTime(2026, 9, 16, 15, 0, 0, 0);

function project(overrides: Partial<WebsiteProjectInput> & Pick<WebsiteProjectInput, "id" | "name">): WebsiteProjectInput {
  return {
    status: "ACTIVE",
    createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0),
    completedAt: null,
    ...overrides,
  };
}

function contract(
  overrides: Partial<WebsiteContractInput> & Pick<WebsiteContractInput, "id">,
): WebsiteContractInput {
  return {
    status: "ACTIVE",
    monthlyAmount: "89.00",
    startDate: fromParisDateTime(2026, 1, 1, 0, 0, 0, 0),
    projectId: null,
    ...overrides,
  };
}

describe("buildWebsiteStatus — cas vides", () => {
  it("entreprise sans site ni projet → NO_WEBSITE, rien n'est inventé", () => {
    const view = buildWebsiteStatus({ website: null, projects: [], contracts: [], now });

    assert.equal(view.status, "NO_WEBSITE");
    assert.equal(view.url, null);
    assert.equal(view.project, null);
    assert.equal(view.goLive, null);
    assert.equal(view.maintenance, null);
    assert.equal(view.monitoring, null);
  });

  it("URL renseignée sans projet → pas de statut opérationnel inventé", () => {
    const view = buildWebsiteStatus({
      website: "https://www.atelier-dupont.fr",
      projects: [],
      now,
    });

    assert.equal(view.status, null);
    assert.equal(view.url?.href, "https://www.atelier-dupont.fr");
    assert.equal(view.url?.host, "atelier-dupont.fr");
    assert.equal(view.project, null);
    assert.equal(view.goLive, null);
  });
});

describe("buildWebsiteStatus — projet en développement", () => {
  const inDevStatuses: ProjectStatus[] = ["PLANNED", "ACTIVE", "WAITING_CLIENT", "REVIEW"];

  for (const status of inDevStatuses) {
    it(`${status} → IN_DEVELOPMENT (pas de LIVE en base)`, () => {
      const view = buildWebsiteStatus({
        website: "https://client.test",
        projects: [project({ id: "p1", name: "Site vitrine", status })],
        now,
      });

      assert.equal(view.status, "IN_DEVELOPMENT");
      assert.equal(view.project?.name, "Site vitrine");
      assert.equal(view.goLive, null);
    });
  }

  it("n'utilise pas dueDate / startDate comme mise en ligne", () => {
    const view = buildWebsiteStatus({
      website: "https://client.test",
      projects: [
        project({
          id: "p1",
          name: "Site",
          status: "ACTIVE",
          completedAt: null,
        }),
      ],
      now,
    });

    assert.equal(view.goLive, null);
  });
});

describe("buildWebsiteStatus — projet LIVE = COMPLETED", () => {
  it("COMPLETED → EN LIGNE et completedAt comme mise en ligne effective", () => {
    const completedAt = fromParisDateTime(2026, 6, 2, 9, 0, 0, 0);
    const view = buildWebsiteStatus({
      website: "client.test",
      projects: [
        project({
          id: "p1",
          name: "Refonte",
          status: "COMPLETED",
          completedAt,
        }),
      ],
      now,
    });

    assert.equal(view.status, "LIVE");
    assert.equal(view.goLive?.kind, "effective");
    assert.equal(view.goLive?.at, completedAt.toISOString());
    assert.equal(view.url?.href, "https://client.test");
    assert.equal(view.url?.host, "client.test");
  });

  it("ARCHIVED → INACTIVE", () => {
    const view = buildWebsiteStatus({
      website: "https://old.test",
      projects: [project({ id: "p1", name: "Ancien site", status: "ARCHIVED" })],
      now,
    });

    assert.equal(view.status, "INACTIVE");
  });
});

describe("buildWebsiteStatus — maintenance (règle startDate MRR / Europe/Paris)", () => {
  const liveProject = project({
    id: "p-live",
    name: "Site livré",
    status: "COMPLETED",
    completedAt: fromParisDateTime(2026, 3, 1, 10, 0, 0, 0),
  });

  it("ACTIVE déjà commencé → EN MAINTENANCE + montant normalisé (pas de float)", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [liveProject],
      contracts: [
        contract({
          id: "c1",
          monthlyAmount: "89.5",
          startDate: fromParisDateTime(2026, 9, 16, 0, 0, 0, 0),
          projectId: "p-live",
        }),
      ],
      now,
    });

    assert.equal(view.status, "MAINTENANCE");
    assert.equal(view.maintenance?.monthlyAmount, "89.50");
    assert.equal(view.maintenance?.started, true);
    assert.equal(view.maintenance?.status, "ACTIVE");
  });

  it("ACTIVE dont startDate est demain Paris n'est pas de la maintenance déjà commencée", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [liveProject],
      contracts: [
        contract({
          id: "c-future",
          startDate: fromParisDateTime(2026, 9, 17, 0, 0, 0, 0),
          projectId: "p-live",
        }),
      ],
      now,
    });

    assert.equal(view.status, "LIVE");
    assert.equal(view.maintenance?.started, false);
    assert.equal(view.maintenance?.status, "ACTIVE");
    assert.equal(view.maintenance?.monthlyAmount, "89.00");
  });

  it("juste après minuit Paris, le contrat du jour compte comme commencé", () => {
    const justAfterMidnight = fromParisDateTime(2026, 9, 16, 0, 1, 0, 0);
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [liveProject],
      contracts: [
        contract({
          id: "c-today",
          startDate: fromParisDateTime(2026, 9, 16, 0, 0, 0, 0),
          projectId: "p-live",
        }),
      ],
      now: justAfterMidnight,
    });

    assert.equal(view.status, "MAINTENANCE");
    assert.equal(view.maintenance?.started, true);
  });

  it("PAUSED / suspendu → reste EN LIGNE, contrat visible", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [liveProject],
      contracts: [
        contract({
          id: "c-paused",
          status: "PAUSED" satisfies MaintenanceStatus,
          startDate: fromParisDateTime(2026, 1, 1, 0, 0, 0, 0),
          projectId: "p-live",
        }),
      ],
      now,
    });

    assert.equal(view.status, "LIVE");
    assert.equal(view.maintenance?.status, "PAUSED");
    assert.equal(view.maintenance?.started, true);
  });

  it("ENDED ne bascule pas en EN MAINTENANCE", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [liveProject],
      contracts: [contract({ id: "c-ended", status: "ENDED", projectId: "p-live" })],
      now,
    });

    assert.equal(view.status, "LIVE");
    assert.equal(view.maintenance?.status, "ENDED");
  });
});

describe("buildWebsiteStatus — plusieurs projets (selectPrincipalProject partagé)", () => {
  it("préfère le projet ACTIVE au COMPLETED encore en maintenance", () => {
    const view = buildWebsiteStatus({
      website: "https://client.test",
      projects: [
        project({
          id: "p-new",
          name: "Refonte en cours",
          status: "ACTIVE",
          createdAt: fromParisDateTime(2026, 9, 10, 10, 0, 0, 0),
        }),
        project({
          id: "p-live",
          name: "Site actuel",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 4, 1, 10, 0, 0, 0),
        }),
      ],
      contracts: [
        contract({
          id: "c1",
          projectId: "p-live",
          startDate: fromParisDateTime(2026, 4, 15, 0, 0, 0, 0),
        }),
      ],
      now,
    });

    assert.equal(view.project?.id, "p-new");
    assert.equal(view.project?.source, "in_development");
    assert.equal(view.status, "IN_DEVELOPMENT");
  });

  it("sans projet en cours, préfère le projet lié à une maintenance ACTIVE commencée", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [
        project({
          id: "p-newer-live",
          name: "Autre livré",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 8, 15, 10, 0, 0, 0),
        }),
        project({
          id: "p-maintained",
          name: "Site sous contrat",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 2, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 3, 1, 10, 0, 0, 0),
        }),
      ],
      contracts: [
        contract({
          id: "c1",
          projectId: "p-maintained",
          startDate: fromParisDateTime(2026, 4, 1, 0, 0, 0, 0),
        }),
      ],
      now,
    });

    assert.equal(view.project?.id, "p-maintained");
    assert.equal(view.project?.source, "completed_maintenance");
    assert.equal(view.status, "MAINTENANCE");
  });

  it("V2 picker : selectedProjectId outrepasse l'heuristique sans être persisté", () => {
    const view = buildWebsiteStatus({
      website: "https://a.test",
      selectedProjectId: "p-dev",
      projects: [
        project({
          id: "p-live",
          name: "Livré",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 2, 1, 10, 0, 0, 0),
        }),
        project({
          id: "p-dev",
          name: "V2 en cours",
          status: "ACTIVE",
          createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0),
        }),
      ],
      now,
    });

    assert.equal(view.project?.id, "p-dev");
    assert.equal(view.project?.source, "explicit");
    assert.equal(view.status, "IN_DEVELOPMENT");
  });
});

describe("buildWebsiteStatus — V2 non implémenté", () => {
  it("ne peuple aucun champ de monitoring HTTP", () => {
    const view = buildWebsiteStatus({
      website: "https://live.test",
      projects: [
        project({
          id: "p1",
          name: "Site",
          status: "COMPLETED",
          completedAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
        }),
      ],
      now,
    });

    assert.equal(view.monitoring, null);
  });
});
