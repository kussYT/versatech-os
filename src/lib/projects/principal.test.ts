import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import { buildClientJourney, type ClientJourneyInput, type ClientJourneyProject } from "@/lib/client-journey";
import { selectPrincipalProject, type PrincipalProjectInput } from "./principal";
import { buildWebsiteStatus, type WebsiteProjectInput } from "@/lib/website/status";

const now = fromParisDateTime(2026, 9, 16, 15, 0, 0, 0);

function project(
  overrides: Partial<PrincipalProjectInput> & Pick<PrincipalProjectInput, "id" | "status">,
): PrincipalProjectInput {
  return {
    createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
    updatedAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
    startDate: null,
    completedAt: null,
    ...overrides,
  };
}

describe("selectPrincipalProject", () => {
  it("choisit le projet ACTIVE plutôt qu'un ancien COMPLETED avec maintenance commencée", () => {
    const selected = selectPrincipalProject(
      [
        project({
          id: "p-old",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2025, 1, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2025, 6, 1, 10, 0, 0, 0),
        }),
        project({
          id: "p-new",
          status: "ACTIVE",
          createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0),
          startDate: fromParisDateTime(2026, 9, 2, 10, 0, 0, 0),
        }),
      ],
      [
        {
          status: "ACTIVE",
          startDate: fromParisDateTime(2025, 7, 1, 0, 0, 0, 0),
          projectId: "p-old",
        },
      ],
      { now },
    );

    assert.equal(selected?.project.id, "p-new");
    assert.equal(selected?.source, "in_development");
  });

  it("WAITING_CLIENT et REVIEW comptent comme développement en cours", () => {
    const waiting = selectPrincipalProject(
      [
        project({ id: "p-live", status: "COMPLETED", completedAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0) }),
        project({ id: "p-wait", status: "WAITING_CLIENT", startDate: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0) }),
      ],
      [],
      { now },
    );
    assert.equal(waiting?.project.id, "p-wait");
    assert.equal(waiting?.source, "in_development");
  });

  it("sans projet en cours, préfère COMPLETED avec maintenance ACTIVE commencée", () => {
    const selected = selectPrincipalProject(
      [
        project({
          id: "p-newer-live",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 8, 15, 10, 0, 0, 0),
        }),
        project({
          id: "p-maintained",
          status: "COMPLETED",
          createdAt: fromParisDateTime(2026, 2, 1, 10, 0, 0, 0),
          completedAt: fromParisDateTime(2026, 3, 1, 10, 0, 0, 0),
        }),
      ],
      [
        {
          status: "ACTIVE",
          startDate: fromParisDateTime(2026, 4, 1, 0, 0, 0, 0),
          projectId: "p-maintained",
        },
      ],
      { now },
    );

    assert.equal(selected?.project.id, "p-maintained");
    assert.equal(selected?.source, "completed_maintenance");
  });

  it("un contrat ACTIVE futur ne compte pas comme maintenance commencée", () => {
    const selected = selectPrincipalProject(
      [
        project({
          id: "p-future",
          status: "COMPLETED",
          completedAt: fromParisDateTime(2026, 3, 1, 10, 0, 0, 0),
        }),
        project({
          id: "p-recent",
          status: "COMPLETED",
          completedAt: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0),
        }),
      ],
      [
        {
          status: "ACTIVE",
          startDate: fromParisDateTime(2026, 10, 1, 0, 0, 0, 0),
          projectId: "p-future",
        },
      ],
      { now },
    );

    assert.equal(selected?.project.id, "p-recent");
    assert.equal(selected?.source, "completed");
  });

  it("PLANNED passe après COMPLETED, ARCHIVED en dernier", () => {
    const planned = selectPrincipalProject(
      [
        project({ id: "p-arch", status: "ARCHIVED", createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0) }),
        project({ id: "p-plan", status: "PLANNED", createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0) }),
      ],
      [],
      { now },
    );
    assert.equal(planned?.project.id, "p-plan");
    assert.equal(planned?.source, "planned");

    const archived = selectPrincipalProject(
      [project({ id: "p-arch", status: "ARCHIVED" })],
      [],
      { now },
    );
    assert.equal(archived?.source, "archived");
  });

  it("départage les ACTIVE par startDate puis createdAt", () => {
    const selected = selectPrincipalProject(
      [
        project({
          id: "p-old-start",
          status: "ACTIVE",
          startDate: fromParisDateTime(2026, 7, 1, 10, 0, 0, 0),
          createdAt: fromParisDateTime(2026, 9, 10, 10, 0, 0, 0),
        }),
        project({
          id: "p-new-start",
          status: "ACTIVE",
          startDate: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0),
          createdAt: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0),
        }),
      ],
      [],
      { now },
    );

    assert.equal(selected?.project.id, "p-new-start");
  });

  it("selectedProjectId explicite outrepasse l'heuristique s'il est valide", () => {
    const selected = selectPrincipalProject(
      [
        project({ id: "p-a", status: "ACTIVE" }),
        project({ id: "p-b", status: "PLANNED" }),
      ],
      [],
      { selectedProjectId: "p-b", now },
    );

    assert.equal(selected?.project.id, "p-b");
    assert.equal(selected?.source, "explicit");
  });

  it("un selectedProjectId invalide retombe sur l'heuristique", () => {
    const selected = selectPrincipalProject(
      [project({ id: "p-a", status: "ACTIVE" })],
      [],
      { selectedProjectId: "missing", now },
    );

    assert.equal(selected?.project.id, "p-a");
    assert.equal(selected?.source, "in_development");
  });
});

describe("selectPrincipalProject — Journey et Website partagent le même projet", () => {
  function websiteProject(
    overrides: Partial<WebsiteProjectInput> & Pick<WebsiteProjectInput, "id" | "name" | "status">,
  ): WebsiteProjectInput {
    return {
      createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
      completedAt: null,
      ...overrides,
    };
  }

  function journeyProject(
    overrides: Partial<ClientJourneyProject> & Pick<ClientJourneyProject, "id" | "status">,
  ): ClientJourneyProject {
    return {
      name: `Projet ${overrides.id}`,
      startDate: null,
      completedAt: null,
      createdAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
      updatedAt: fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
      opportunityId: null,
      ...overrides,
    };
  }

  it("ACTIVE nouveau vs COMPLETED + maintenance → même principalProject", () => {
    const projects = [
      websiteProject({
        id: "p-old",
        name: "Ancien site",
        status: "COMPLETED",
        createdAt: fromParisDateTime(2025, 1, 1, 10, 0, 0, 0),
        completedAt: fromParisDateTime(2025, 6, 1, 10, 0, 0, 0),
      }),
      websiteProject({
        id: "p-new",
        name: "Refonte",
        status: "ACTIVE",
        createdAt: fromParisDateTime(2026, 9, 1, 10, 0, 0, 0),
        startDate: fromParisDateTime(2026, 9, 2, 10, 0, 0, 0),
      }),
    ];
    const contracts = [
      {
        id: "c-old",
        status: "ACTIVE" as const,
        monthlyAmount: "89.00",
        startDate: fromParisDateTime(2025, 7, 1, 0, 0, 0, 0),
        projectId: "p-old",
      },
    ];

    const principal = selectPrincipalProject(projects, contracts, { now });
    const website = buildWebsiteStatus({
      website: "https://client.test",
      projects,
      contracts,
      now,
    });
    const input: ClientJourneyInput = {
      interactions: [],
      quotes: [],
      projects: projects.map((item) =>
        journeyProject({
          id: item.id,
          name: item.name,
          status: item.status,
          startDate: item.startDate ?? null,
          completedAt: item.completedAt ?? null,
          createdAt: item.createdAt ?? fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
        }),
      ),
      payments: [],
      contracts,
      opportunities: [],
    };
    const journey = buildClientJourney(input, { now });

    assert.equal(principal?.project.id, "p-new");
    assert.equal(website.project?.id, "p-new");
    assert.equal(website.status, "IN_DEVELOPMENT");
    assert.equal(journey.principal.project?.id, "p-new");
    assert.equal(journey.steps.find((step) => step.key === "DEVELOPPEMENT")?.status, "COMPLETED");
    assert.notEqual(journey.steps.find((step) => step.key === "MISE_EN_LIGNE")?.status, "COMPLETED");
  });

  it("selectedProjectId explicite aligne Journey et Website", () => {
    const projects = [
      websiteProject({
        id: "p-live",
        name: "Livré",
        status: "COMPLETED",
        completedAt: fromParisDateTime(2026, 2, 1, 10, 0, 0, 0),
      }),
      websiteProject({
        id: "p-dev",
        name: "V2",
        status: "ACTIVE",
      }),
    ];

    const website = buildWebsiteStatus({
      website: "https://a.test",
      projects,
      selectedProjectId: "p-live",
      now,
    });
    const journey = buildClientJourney(
      {
        interactions: [],
        quotes: [],
        projects: projects.map((item) =>
        journeyProject({
          id: item.id,
          name: item.name,
          status: item.status,
          startDate: item.startDate ?? null,
          completedAt: item.completedAt ?? null,
          createdAt: item.createdAt ?? fromParisDateTime(2026, 1, 1, 10, 0, 0, 0),
        }),
      ),
        payments: [],
        contracts: [],
        opportunities: [],
      },
      { now, principalProjectId: "p-live" },
    );

    assert.equal(website.project?.id, "p-live");
    assert.equal(website.project?.source, "explicit");
    assert.equal(website.status, "LIVE");
    assert.equal(journey.principal.project?.id, "p-live");
    assert.equal(journey.steps.find((step) => step.key === "MISE_EN_LIGNE")?.status, "COMPLETED");
  });
});
