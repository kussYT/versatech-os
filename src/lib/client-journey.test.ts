import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fromParisDateTime } from "@/lib/dates";
import {
  buildClientJourney,
  selectPrincipalJourneyContext,
  type ClientJourneyInput,
  type ClientJourneyPayment,
  type ClientJourneyProject,
  type ClientJourneyQuote,
  type JourneyStepKey,
} from "./client-journey";

const NOW = fromParisDateTime(2026, 9, 16, 15, 0, 0, 0);

function statusOf(input: ClientJourneyInput, key: JourneyStepKey) {
  const journey = buildClientJourney(input, { now: NOW });
  const step = journey.steps.find((item) => item.key === key);
  assert.ok(step);
  return step;
}

function empty(): ClientJourneyInput {
  return {
    interactions: [],
    quotes: [],
    projects: [],
    payments: [],
    contracts: [],
    opportunities: [],
  };
}

function quote(overrides: Partial<ClientJourneyQuote> & Pick<ClientJourneyQuote, "id" | "status">): ClientJourneyQuote {
  return {
    reference: `DEV-${overrides.id}`,
    amountIncTax: "3200.00",
    createdAt: fromParisDateTime(2026, 8, 1, 10, 0, 0, 0),
    sentAt: null,
    acceptedAt: null,
    projectId: null,
    opportunityId: "opp-main",
    ...overrides,
  };
}

function project(
  overrides: Partial<ClientJourneyProject> & Pick<ClientJourneyProject, "id" | "status">,
): ClientJourneyProject {
  return {
    name: `Projet ${overrides.id}`,
    startDate: null,
    completedAt: null,
    createdAt: fromParisDateTime(2026, 8, 10, 10, 0, 0, 0),
    updatedAt: fromParisDateTime(2026, 8, 10, 10, 0, 0, 0),
    opportunityId: "opp-main",
    ...overrides,
  };
}

function payment(
  overrides: Partial<ClientJourneyPayment> & Pick<ClientJourneyPayment, "id" | "amount" | "status">,
): ClientJourneyPayment {
  return {
    paidAt: null,
    createdAt: fromParisDateTime(2026, 8, 12, 10, 0, 0, 0),
    quoteId: "q-main",
    projectId: "p-main",
    ...overrides,
  };
}

const terrainVisit = {
  id: "i-terrain",
  type: "MEETING" as const,
  direction: "INTERNAL" as const,
  result: "OTHER" as const,
  notes: "Visite terrain",
  subject: null,
  occurredAt: fromParisDateTime(2026, 9, 2, 10, 30, 0, 0),
};

const realMeeting = {
  id: "i-rdv",
  type: "MEETING" as const,
  direction: "OUTBOUND" as const,
  result: "INTERESTED" as const,
  notes: "Démo produit",
  subject: "RDV commercial",
  occurredAt: fromParisDateTime(2026, 9, 5, 14, 0, 0, 0),
};

describe("buildClientJourney — prospect sans interaction", () => {
  it("place Contact en CURRENT et le reste en UPCOMING, sans date inventée", () => {
    const journey = buildClientJourney(empty(), { now: NOW });
    assert.equal(journey.complete, false);
    assert.equal(journey.steps.length, 9);
    assert.equal(journey.steps[0]?.key, "CONTACT");
    assert.equal(journey.steps[0]?.status, "CURRENT");
    assert.equal(journey.steps[0]?.date, null);
    assert.ok(journey.steps.slice(1).every((step) => step.status === "UPCOMING"));
    assert.ok(journey.steps.every((step) => step.date === null));
  });

  it("ignore une NOTE interne : ce n'est pas un Contact", () => {
    const step = statusOf(
      {
        ...empty(),
        interactions: [
          {
            id: "note",
            type: "NOTE",
            direction: "INTERNAL",
            notes: "Relance à préparer",
            occurredAt: fromParisDateTime(2026, 9, 1, 9, 0, 0, 0),
          },
        ],
      },
      "CONTACT",
    );
    assert.equal(step.status, "CURRENT");
    assert.equal(step.date, null);
  });
});

describe("buildClientJourney — contact et RDV", () => {
  it("compte une visite terrain comme Contact mais pas comme RDV", () => {
    const journey = buildClientJourney({ ...empty(), interactions: [terrainVisit] }, { now: NOW });
    const contact = journey.steps.find((step) => step.key === "CONTACT");
    const rdv = journey.steps.find((step) => step.key === "RDV");
    assert.equal(contact?.status, "COMPLETED");
    assert.equal(contact?.date, terrainVisit.occurredAt.toISOString());
    assert.equal(contact?.source, "Visite terrain");
    assert.equal(rdv?.status, "CURRENT");
    assert.equal(rdv?.date, null);
  });

  it("compte un vrai MEETING comme RDV", () => {
    const rdv = statusOf({ ...empty(), interactions: [terrainVisit, realMeeting] }, "RDV");
    assert.equal(rdv.status, "COMPLETED");
    assert.equal(rdv.date, realMeeting.occurredAt.toISOString());
    assert.equal(rdv.source, "MEETING");
  });

  it("un appel commercial est un Contact, pas un RDV", () => {
    const journey = buildClientJourney(
      {
        ...empty(),
        interactions: [
          {
            id: "call",
            type: "CALL",
            direction: "OUTBOUND",
            occurredAt: fromParisDateTime(2026, 9, 3, 11, 0, 0, 0),
          },
        ],
      },
      { now: NOW },
    );
    assert.equal(journey.steps.find((step) => step.key === "CONTACT")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "RDV")?.status, "CURRENT");
  });
});

describe("buildClientJourney — devis et signature", () => {
  it("un devis brouillon complète Devis, pas Signature", () => {
    const createdAt = fromParisDateTime(2026, 9, 8, 9, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [quote({ id: "q-draft", status: "DRAFT", createdAt, sentAt: null })],
      },
      { now: NOW },
    );
    const devis = journey.steps.find((step) => step.key === "DEVIS");
    const signature = journey.steps.find((step) => step.key === "SIGNATURE");
    assert.equal(devis?.status, "COMPLETED");
    assert.equal(devis?.date, createdAt.toISOString());
    assert.equal(devis?.source, "DRAFT");
    assert.notEqual(signature?.status, "COMPLETED");
  });

  it("un devis envoyé utilise sentAt et ne signe pas", () => {
    const sentAt = fromParisDateTime(2026, 9, 9, 16, 0, 0, 0);
    const devis = statusOf(
      {
        ...empty(),
        quotes: [quote({ id: "q-sent", status: "SENT", sentAt })],
      },
      "DEVIS",
    );
    assert.equal(devis.status, "COMPLETED");
    assert.equal(devis.date, sentAt.toISOString());
    assert.equal(devis.source, "SENT");
    assert.notEqual(
      statusOf({ ...empty(), quotes: [quote({ id: "q-sent", status: "SENT", sentAt })] }, "SIGNATURE").status,
      "COMPLETED",
    );
  });

  it("un devis ACCEPTED complète Signature avec acceptedAt", () => {
    const acceptedAt = fromParisDateTime(2026, 9, 10, 11, 0, 0, 0);
    const signature = statusOf(
      {
        ...empty(),
        quotes: [
          quote({
            id: "q-ok",
            status: "ACCEPTED",
            sentAt: fromParisDateTime(2026, 9, 9, 10, 0, 0, 0),
            acceptedAt,
          }),
        ],
      },
      "SIGNATURE",
    );
    assert.equal(signature.status, "COMPLETED");
    assert.equal(signature.date, acceptedAt.toISOString());
    assert.equal(signature.source, "ACCEPTED");
  });
});

describe("buildClientJourney — paiements", () => {
  const accepted = quote({
    id: "q-main",
    status: "ACCEPTED",
    amountIncTax: "3200.00",
    projectId: "p-main",
    sentAt: fromParisDateTime(2026, 8, 2, 10, 0, 0, 0),
    acceptedAt: fromParisDateTime(2026, 8, 4, 10, 0, 0, 0),
  });

  it("un paiement partiel PAID rattaché au devis = Acompte, pas Solde", () => {
    const paidAt = fromParisDateTime(2026, 8, 12, 9, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [accepted],
        payments: [
          payment({
            id: "pay-1",
            amount: "1280.00",
            status: "PAID",
            paidAt,
            quoteId: "q-main",
            projectId: "p-main",
          }),
        ],
      },
      { now: NOW },
    );
    assert.equal(journey.steps.find((step) => step.key === "ACOMPTE")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "ACOMPTE")?.date, paidAt.toISOString());
    assert.notEqual(journey.steps.find((step) => step.key === "SOLDE")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "SOLDE")?.date, null);
  });

  it("n'utilise pas un paiement d'entreprise non rattaché comme acompte", () => {
    const acompte = statusOf(
      {
        ...empty(),
        quotes: [accepted],
        payments: [
          payment({
            id: "orphan",
            amount: "1280.00",
            status: "PAID",
            paidAt: fromParisDateTime(2026, 8, 12, 9, 0, 0, 0),
            quoteId: null,
            projectId: null,
          }),
        ],
      },
      "ACOMPTE",
    );
    assert.notEqual(acompte.status, "COMPLETED");
    assert.equal(acompte.date, null);
  });

  it("deux PAID le même jour : l'acompte est le premier créé, pas le plus gros", () => {
    const samePaidAt = fromParisDateTime(2026, 8, 12, 0, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [accepted],
        payments: [
          payment({
            id: "pay-balance",
            amount: "1920.00",
            status: "PAID",
            paidAt: samePaidAt,
            createdAt: fromParisDateTime(2026, 8, 12, 11, 0, 0, 0),
          }),
          payment({
            id: "pay-deposit",
            amount: "1280.00",
            status: "PAID",
            paidAt: samePaidAt,
            createdAt: fromParisDateTime(2026, 8, 12, 10, 0, 0, 0),
          }),
        ],
      },
      { now: NOW },
    );
    const acompte = journey.steps.find((step) => step.key === "ACOMPTE");
    assert.equal(acompte?.status, "COMPLETED");
    assert.equal(acompte?.context, "1280.00 €");
  });

  it("un encaissement TTC complet solde le devis (centimes, pas de float)", () => {
    const depositAt = fromParisDateTime(2026, 8, 12, 9, 0, 0, 0);
    const balanceAt = fromParisDateTime(2026, 9, 1, 9, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [accepted],
        payments: [
          payment({ id: "pay-1", amount: "1280.00", status: "PAID", paidAt: depositAt }),
          payment({ id: "pay-2", amount: "1920.00", status: "PAID", paidAt: balanceAt }),
        ],
      },
      { now: NOW },
    );
    assert.equal(journey.steps.find((step) => step.key === "ACOMPTE")?.status, "COMPLETED");
    const solde = journey.steps.find((step) => step.key === "SOLDE");
    assert.equal(solde?.status, "COMPLETED");
    assert.equal(solde?.date, balanceAt.toISOString());
  });

  it("un paiement unique à 100 % complète Acompte et Solde avec le même paiement", () => {
    const paidAt = fromParisDateTime(2026, 8, 12, 9, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [accepted],
        payments: [payment({ id: "pay-full", amount: "3200.00", status: "PAID", paidAt })],
      },
      { now: NOW },
    );
    const acompte = journey.steps.find((step) => step.key === "ACOMPTE");
    const solde = journey.steps.find((step) => step.key === "SOLDE");
    assert.equal(acompte?.status, "COMPLETED");
    assert.equal(solde?.status, "COMPLETED");
    assert.equal(acompte?.date, paidAt.toISOString());
    assert.equal(solde?.date, paidAt.toISOString());
  });

  it("ignore PENDING / CANCELED pour l'acompte et le solde", () => {
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [accepted],
        payments: [
          payment({ id: "pending", amount: "1280.00", status: "PENDING", paidAt: null }),
          payment({ id: "canceled", amount: "1920.00", status: "CANCELED", paidAt: null }),
        ],
      },
      { now: NOW },
    );
    assert.notEqual(journey.steps.find((step) => step.key === "ACOMPTE")?.status, "COMPLETED");
    assert.notEqual(journey.steps.find((step) => step.key === "SOLDE")?.status, "COMPLETED");
  });
});

describe("buildClientJourney — projet", () => {
  it("un projet PLANNED n'est pas du développement", () => {
    const step = statusOf(
      {
        ...empty(),
        projects: [project({ id: "p-planned", status: "PLANNED", startDate: fromParisDateTime(2026, 9, 1, 0, 0, 0, 0) })],
      },
      "DEVELOPPEMENT",
    );
    assert.notEqual(step.status, "COMPLETED");
  });

  it("un projet ACTIVE est du développement, date = startDate réelle", () => {
    const startDate = fromParisDateTime(2026, 8, 20, 0, 0, 0, 0);
    const step = statusOf(
      {
        ...empty(),
        projects: [project({ id: "p-main", status: "ACTIVE", startDate })],
      },
      "DEVELOPPEMENT",
    );
    assert.equal(step.status, "COMPLETED");
    assert.equal(step.date, startDate.toISOString());
    assert.equal(step.source, "ACTIVE");
  });

  it("WAITING_CLIENT et REVIEW comptent comme développement commencé", () => {
    assert.equal(
      statusOf({ ...empty(), projects: [project({ id: "p-wait", status: "WAITING_CLIENT" })] }, "DEVELOPPEMENT").status,
      "COMPLETED",
    );
    assert.equal(
      statusOf({ ...empty(), projects: [project({ id: "p-review", status: "REVIEW" })] }, "DEVELOPPEMENT").status,
      "COMPLETED",
    );
  });

  it("COMPLETED représente la mise en ligne (pas de statut LIVE)", () => {
    const completedAt = fromParisDateTime(2026, 9, 14, 18, 0, 0, 0);
    const journey = buildClientJourney(
      {
        ...empty(),
        projects: [
          project({
            id: "p-live",
            status: "COMPLETED",
            startDate: fromParisDateTime(2026, 8, 1, 0, 0, 0, 0),
            completedAt,
          }),
        ],
      },
      { now: NOW },
    );
    assert.equal(journey.steps.find((step) => step.key === "DEVELOPPEMENT")?.status, "COMPLETED");
    const live = journey.steps.find((step) => step.key === "MISE_EN_LIGNE");
    assert.equal(live?.status, "COMPLETED");
    assert.equal(live?.date, completedAt.toISOString());
    assert.equal(live?.source, "COMPLETED");
  });

  it("n'invente pas completedAt si le projet est ACTIVE", () => {
    const live = statusOf({ ...empty(), projects: [project({ id: "p-main", status: "ACTIVE" })] }, "MISE_EN_LIGNE");
    assert.notEqual(live.status, "COMPLETED");
    assert.equal(live.date, null);
  });
});

describe("buildClientJourney — maintenance Europe/Paris", () => {
  it("un contrat ACTIVE futur n'est pas commencé (hors MRR)", () => {
    const startDate = fromParisDateTime(2026, 10, 1, 0, 0, 0, 0);
    const step = statusOf(
      {
        ...empty(),
        contracts: [
          {
            id: "m-future",
            status: "ACTIVE",
            monthlyAmount: "89.00",
            startDate,
            projectId: null,
          },
        ],
      },
      "MAINTENANCE",
    );
    assert.notEqual(step.status, "COMPLETED");
    assert.equal(step.date, startDate.toISOString());
    assert.match(step.context ?? "", /démarrage à venir/);
  });

  it("un contrat ACTIVE déjà commencé (jour civil Paris) complète Maintenance", () => {
    const startDate = fromParisDateTime(2026, 9, 16, 0, 0, 0, 0);
    const step = statusOf(
      {
        ...empty(),
        contracts: [
          {
            id: "m-now",
            status: "ACTIVE",
            monthlyAmount: "89.00",
            startDate,
            projectId: null,
          },
        ],
      },
      "MAINTENANCE",
    );
    assert.equal(step.status, "COMPLETED");
    assert.equal(step.date, startDate.toISOString());
  });

  it("un contrat PAUSED n'est pas de la maintenance active", () => {
    const step = statusOf(
      {
        ...empty(),
        contracts: [
          {
            id: "m-paused",
            status: "PAUSED",
            monthlyAmount: "89.00",
            startDate: fromParisDateTime(2026, 1, 1, 0, 0, 0, 0),
            projectId: null,
          },
        ],
      },
      "MAINTENANCE",
    );
    assert.notEqual(step.status, "COMPLETED");
  });
});

describe("buildClientJourney — ordre CURRENT malgré une étape tardive COMPLETED", () => {
  it("ne fabrique pas un Contact manquant si un devis existe déjà", () => {
    const journey = buildClientJourney(
      {
        ...empty(),
        quotes: [quote({ id: "q-sent", status: "SENT", sentAt: fromParisDateTime(2026, 9, 9, 16, 0, 0, 0) })],
      },
      { now: NOW },
    );
    assert.equal(journey.steps.find((step) => step.key === "CONTACT")?.status, "CURRENT");
    assert.equal(journey.steps.find((step) => step.key === "DEVIS")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "RDV")?.status, "UPCOMING");
  });
});

describe("buildClientJourney — multi devis / multi projets", () => {
  it("suit le projet ACTIVE et ignore le devis/paiements d'un autre projet", () => {
    const journey = buildClientJourney(
      {
        ...empty(),
        interactions: [terrainVisit, realMeeting],
        opportunities: [
          { id: "opp-a", title: "Site A", stage: "WON" },
          { id: "opp-b", title: "App B", stage: "WON" },
        ],
        projects: [
          project({
            id: "p-old",
            name: "Ancien",
            status: "COMPLETED",
            opportunityId: "opp-b",
            completedAt: fromParisDateTime(2026, 7, 1, 0, 0, 0, 0),
            updatedAt: fromParisDateTime(2026, 7, 1, 0, 0, 0, 0),
          }),
          project({
            id: "p-main",
            name: "Refonte",
            status: "ACTIVE",
            opportunityId: "opp-a",
            startDate: fromParisDateTime(2026, 8, 20, 0, 0, 0, 0),
            updatedAt: fromParisDateTime(2026, 9, 1, 0, 0, 0, 0),
          }),
        ],
        quotes: [
          quote({
            id: "q-old",
            reference: "DEV-OLD",
            status: "ACCEPTED",
            amountIncTax: "9000.00",
            projectId: "p-old",
            opportunityId: "opp-b",
            acceptedAt: fromParisDateTime(2026, 6, 1, 0, 0, 0, 0),
          }),
          quote({
            id: "q-main",
            reference: "DEV-MAIN",
            status: "ACCEPTED",
            amountIncTax: "3200.00",
            projectId: "p-main",
            opportunityId: "opp-a",
            acceptedAt: fromParisDateTime(2026, 8, 4, 0, 0, 0, 0),
          }),
        ],
        payments: [
          payment({
            id: "pay-old",
            amount: "9000.00",
            status: "PAID",
            paidAt: fromParisDateTime(2026, 6, 15, 0, 0, 0, 0),
            quoteId: "q-old",
            projectId: "p-old",
          }),
          payment({
            id: "pay-main",
            amount: "1280.00",
            status: "PAID",
            paidAt: fromParisDateTime(2026, 8, 12, 0, 0, 0, 0),
            quoteId: "q-main",
            projectId: "p-main",
          }),
        ],
        contracts: [
          {
            id: "m-old",
            status: "ACTIVE",
            monthlyAmount: "89.00",
            startDate: fromParisDateTime(2026, 7, 15, 0, 0, 0, 0),
            projectId: "p-old",
          },
        ],
      },
      { now: NOW },
    );

    assert.equal(journey.principal.project?.id, "p-main");
    assert.equal(journey.principal.quote?.id, "q-main");
    assert.equal(journey.principal.reason, "Projet actif");
    assert.equal(journey.steps.find((step) => step.key === "SIGNATURE")?.context, "DEV-MAIN");
    assert.equal(journey.steps.find((step) => step.key === "ACOMPTE")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "DEVELOPPEMENT")?.status, "COMPLETED");
    assert.equal(journey.steps.find((step) => step.key === "MISE_EN_LIGNE")?.status, "CURRENT");
    assert.notEqual(journey.steps.find((step) => step.key === "SOLDE")?.status, "COMPLETED");
    assert.notEqual(journey.steps.find((step) => step.key === "MAINTENANCE")?.status, "COMPLETED");
  });

  it("accepte un principalProjectId pour préparer V2 sans picker", () => {
    const input: ClientJourneyInput = {
      ...empty(),
      projects: [
        project({ id: "p-a", status: "ACTIVE", name: "A" }),
        project({ id: "p-b", status: "PLANNED", name: "B" }),
      ],
    };
    const auto = selectPrincipalJourneyContext(input, { now: NOW });
    const chosen = selectPrincipalJourneyContext(input, { principalProjectId: "p-b", now: NOW });
    assert.equal(auto.project?.id, "p-a");
    assert.equal(chosen.project?.id, "p-b");
    assert.equal(buildClientJourney(input, { now: NOW, principalProjectId: "p-b" }).principal.project?.id, "p-b");
  });
});

describe("buildClientJourney — parcours complet", () => {
  it("marque le parcours complete quand toutes les étapes le sont", () => {
    const journey = buildClientJourney(
      {
        interactions: [terrainVisit, realMeeting],
        quotes: [
          quote({
            id: "q-main",
            status: "ACCEPTED",
            amountIncTax: "100.00",
            projectId: "p-main",
            sentAt: fromParisDateTime(2026, 8, 2, 10, 0, 0, 0),
            acceptedAt: fromParisDateTime(2026, 8, 4, 10, 0, 0, 0),
          }),
        ],
        projects: [
          project({
            id: "p-main",
            status: "COMPLETED",
            startDate: fromParisDateTime(2026, 8, 10, 0, 0, 0, 0),
            completedAt: fromParisDateTime(2026, 9, 1, 0, 0, 0, 0),
          }),
        ],
        payments: [
          payment({
            id: "pay-full",
            amount: "100.00",
            status: "PAID",
            paidAt: fromParisDateTime(2026, 8, 12, 0, 0, 0, 0),
          }),
        ],
        contracts: [
          {
            id: "m-1",
            status: "ACTIVE",
            monthlyAmount: "49.00",
            startDate: fromParisDateTime(2026, 9, 2, 0, 0, 0, 0),
            projectId: "p-main",
          },
        ],
        opportunities: [{ id: "opp-main", title: "Site", stage: "WON" }],
      },
      { now: NOW },
    );

    assert.equal(journey.complete, true);
    assert.ok(journey.steps.every((step) => step.status === "COMPLETED"));
  });
});
