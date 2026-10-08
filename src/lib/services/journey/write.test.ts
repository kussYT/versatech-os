import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import type { SessionUser } from "@/lib/auth/types";
import { JOURNEY_STEP_KEYS } from "@/lib/client-journey";
import {
  alignJourneyContext,
  DECLARED_JOURNEY_STEPS,
  defaultJourneyContextKey,
  eventsForJourneyContext,
  journeyContextKey,
  listJourneyContexts,
  visibleJourneyCursor,
  type JourneyCursorEventView,
} from "@/lib/crm/journey-cursor";
import {
  adoptDeclaredJourneyForProject,
  resetDeclaredJourneyStep,
  setDeclaredJourneyStep,
  type JourneyCursorRow,
  type JourneyWriteDb,
  type JourneyWriteTx,
} from "./write";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};

function createDb(seed?: {
  project?: { id: string; companyId: string; opportunityId: string | null };
  opportunity?: { id: string; companyId: string };
}) {
  const cursors = new Map<string, JourneyCursorRow & { companyId: string; opportunityId: string | null; projectId: string | null }>();
  const events: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];
  let seq = 0;

  const tx: JourneyWriteTx = {
    journeyCursor: {
      findUnique: async ({ where }) => cursors.get(where.contextKey) ?? null,
      create: async ({ data }) => {
        const row = { id: `cur_${++seq}`, ...data };
        cursors.set(data.contextKey, row);
        return { id: row.id };
      },
      update: async ({ where, data }) => {
        const row = [...cursors.values()].find((item) => item.id === where.id);
        if (!row) {
          throw new Error("missing cursor");
        }
        row.step = data.step;
        if (data.projectId !== undefined) {
          row.projectId = data.projectId;
        }
        if (data.opportunityId !== undefined) {
          row.opportunityId = data.opportunityId;
        }
        if (data.contextKey && data.contextKey !== row.contextKey) {
          cursors.delete(row.contextKey);
          row.contextKey = data.contextKey;
          cursors.set(data.contextKey, row);
        }
        return { id: row.id };
      },
      delete: async ({ where }) => {
        for (const [key, row] of cursors) {
          if (row.id === where.id) {
            cursors.delete(key);
          }
        }
      },
    },
    journeyCursorEvent: {
      create: async ({ data }) => {
        events.push(data);
      },
    },
    activityLog: {
      create: async ({ data }) => {
        logs.push(data);
      },
    },
  };

  const db: JourneyWriteDb = {
    company: {
      findUnique: async ({ where }) => (where.id === "co_1" ? { id: "co_1" } : null),
    },
    opportunity: {
      findUnique: async ({ where }) => (seed?.opportunity?.id === where.id ? seed.opportunity : null),
    },
    project: {
      findUnique: async ({ where }) => (seed?.project?.id === where.id ? seed.project : null),
    },
    $transaction: async (fn) => fn(tx),
  };

  return { db, cursors, events, logs };
}

describe("journey cursor context", () => {
  test("les étapes déclarées suivent le parcours des faits", () => {
    assert.deepEqual([...DECLARED_JOURNEY_STEPS], [...JOURNEY_STEP_KEYS]);
  });

  test("un projet porte le curseur, même si une opportunité est aussi connue", () => {
    assert.equal(
      journeyContextKey({ companyId: "co_1", opportunityId: "opp_1", projectId: "prj_1" }),
      "project:prj_1",
    );
    assert.equal(
      journeyContextKey({ companyId: "co_1", opportunityId: "opp_1", projectId: null }),
      "opportunity:opp_1",
    );
    const aligned = alignJourneyContext({
      companyId: "co_1",
      projectId: "prj_1",
      opportunityId: "opp_other",
      anchor: {
        project: { id: "prj_1", companyId: "co_1", opportunityId: "opp_1" },
        opportunity: { id: "opp_1", companyId: "co_1" },
      },
    });
    assert.equal(aligned.ok, false);
  });

  test("plusieurs prestations ont chacune un contexte", () => {
    const contexts = listJourneyContexts("co_1", {
      opportunities: [
        { id: "opp_1", title: "Site vitrine" },
        { id: "opp_2", title: "Maintenance" },
      ],
      projects: [{ id: "prj_1", name: "Site", opportunityId: "opp_1" }],
    });
    assert.deepEqual(
      contexts.map((item) => item.contextKey),
      ["opportunity:opp_2", "project:prj_1"],
    );
    assert.equal(
      listJourneyContexts("co_1", { opportunities: [], projects: [] })[0]?.contextKey,
      "company:co_1",
    );
    assert.equal(
      defaultJourneyContextKey(contexts, { projectId: "prj_1", opportunityId: "opp_1" }),
      "project:prj_1",
    );
  });
});

describe("declared journey step writes", () => {
  test("enregistrer puis modifier n'écrit que le curseur, l'historique et le journal", async () => {
    const { db, cursors, events, logs } = createDb({
      project: { id: "prj_1", companyId: "co_1", opportunityId: "opp_1" },
      opportunity: { id: "opp_1", companyId: "co_1" },
    });
    const first = await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: null,
        projectId: "prj_1",
        step: "DEVELOPPEMENT",
      },
      db,
    );
    assert.equal(first.ok, true);
    assert.equal(cursors.get("project:prj_1")?.step, "DEVELOPPEMENT");
    assert.equal(cursors.get("project:prj_1")?.opportunityId, "opp_1");
    assert.equal(events[0]?.action, "set");
    assert.equal(events[0]?.fromStep, null);
    assert.equal(logs[0]?.action, "journey.step_set");

    const second = await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: "prj_1",
        step: "MISE_EN_LIGNE",
      },
      db,
    );
    assert.equal(second.ok, true);
    assert.equal(cursors.get("project:prj_1")?.step, "MISE_EN_LIGNE");
    assert.equal(events[1]?.fromStep, "DEVELOPPEMENT");
    assert.equal(events[1]?.toStep, "MISE_EN_LIGNE");
    assert.equal(logs.length, 2);
  });

  test("la réinitialisation retire le curseur et conserve l'historique", async () => {
    const { db, cursors, events, logs } = createDb({
      opportunity: { id: "opp_1", companyId: "co_1" },
    });
    await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: null,
        step: "RDV",
      },
      db,
    );
    const reset = await resetDeclaredJourneyStep(
      { actor, companyId: "co_1", opportunityId: "opp_1", projectId: null },
      db,
    );
    assert.equal(reset.ok, true);
    assert.equal(cursors.size, 0);
    assert.equal(events.at(-1)?.action, "reset");
    assert.equal(events.at(-1)?.toStep, null);
    assert.equal(logs.at(-1)?.action, "journey.step_reset");

    const again = await resetDeclaredJourneyStep(
      { actor, companyId: "co_1", opportunityId: "opp_1", projectId: null },
      db,
    );
    assert.equal(again.ok, false);
    if (!again.ok) {
      assert.equal(again.code, "NOT_FOUND");
    }
  });

  test("une opportunité d'une autre entreprise est refusée", async () => {
    const { db, cursors, logs } = createDb({
      opportunity: { id: "opp_1", companyId: "co_other" },
    });
    const result = await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: null,
        step: "DEVIS",
      },
      db,
    );
    assert.equal(result.ok, false);
    assert.equal(cursors.size, 0);
    assert.equal(logs.length, 0);
  });

  test("un projet lié reprend le parcours déclaré, puis le calcul automatique", async () => {
    const { db, cursors, events } = createDb({
      opportunity: { id: "opp_1", companyId: "co_1" },
      project: { id: "prj_1", companyId: "co_1", opportunityId: "opp_1" },
    });
    const declared = await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: null,
        step: "DEVELOPPEMENT",
      },
      db,
    );
    assert.equal(declared.ok, true);
    assert.equal(
      visibleJourneyCursor([{ contextKey: "opportunity:opp_1", step: "DEVELOPPEMENT", updatedAt: "" }], {
        contextKey: "project:prj_1",
        opportunityId: "opp_1",
        projectId: "prj_1",
      })?.step,
      "DEVELOPPEMENT",
    );

    const adopted = await db.$transaction((tx) =>
      adoptDeclaredJourneyForProject(tx, {
        actorId: actor.id,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: "prj_1",
      }),
    );
    assert.equal(adopted, true);
    assert.equal(cursors.has("opportunity:opp_1"), false);
    assert.equal(cursors.get("project:prj_1")?.step, "DEVELOPPEMENT");
    assert.equal(cursors.get("project:prj_1")?.opportunityId, "opp_1");
    assert.equal(cursors.size, 1);
    assert.equal(
      listJourneyContexts("co_1", {
        opportunities: [{ id: "opp_1", title: "Site" }],
        projects: [{ id: "prj_1", name: "Site", opportunityId: "opp_1" }],
      }).map((item) => item.contextKey).join(","),
      "project:prj_1",
    );
    const visible = eventsForJourneyContext(
      events.map((event, index): JourneyCursorEventView => ({
        id: String(index),
        contextKey: String(event.contextKey),
        fromStep: event.fromStep as JourneyCursorEventView["fromStep"],
        toStep: event.toStep as JourneyCursorEventView["toStep"],
        action: event.action as JourneyCursorEventView["action"],
        changedAt: "",
      })),
      { contextKey: "project:prj_1", opportunityId: "opp_1", projectId: "prj_1" },
    );
    assert.deepEqual(
      visible.map((event) => event.action),
      ["set", "adopt"],
    );
    assert.equal(visible[0]?.contextKey, "opportunity:opp_1");
    assert.equal(visible[1]?.toStep, "DEVELOPPEMENT");

    const changed = await setDeclaredJourneyStep(
      {
        actor,
        companyId: "co_1",
        opportunityId: "opp_1",
        projectId: "prj_1",
        step: "MISE_EN_LIGNE",
      },
      db,
    );
    assert.equal(changed.ok, true);
    assert.equal(cursors.size, 1);
    assert.equal(cursors.get("project:prj_1")?.step, "MISE_EN_LIGNE");

    const reset = await resetDeclaredJourneyStep(
      { actor, companyId: "co_1", opportunityId: "opp_1", projectId: "prj_1" },
      db,
    );
    assert.equal(reset.ok, true);
    assert.equal(cursors.size, 0);
    assert.equal(events.some((event) => event.action === "set" && event.contextKey === "opportunity:opp_1"), true);
    assert.equal(events.some((event) => event.action === "adopt"), true);
    assert.equal(events.at(-1)?.action, "reset");
    assert.equal(events.at(-1)?.contextKey, "project:prj_1");

    const again = await resetDeclaredJourneyStep(
      { actor, companyId: "co_1", opportunityId: "opp_1", projectId: "prj_1" },
      db,
    );
    assert.equal(again.ok, false);
  });

  test("le service ne touche ni devis, ni paiement, ni étape d'opportunité", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/services/journey/write.ts"), "utf8");
    assert.equal(source.includes("quote."), false);
    assert.equal(source.includes("payment."), false);
    assert.equal(source.includes("lifecycleStatus"), false);
    assert.equal(source.includes("updateQuoteStatus"), false);
    assert.equal(source.includes("changeOpportunityStage"), false);
    const migration = readFileSync(
      path.join(process.cwd(), "prisma/migrations/20261008140000_journey_cursor/migration.sql"),
      "utf8",
    );
    assert.match(migration, /JourneyCursor_projectId_fkey[\s\S]*ON DELETE CASCADE/);
    assert.match(migration, /JourneyCursor_opportunityId_fkey[\s\S]*ON DELETE SET NULL/);
    assert.match(migration, /DELETE FROM "JourneyCursor"[\s\S]*"projectId" IS NULL/);
    const projectAction = readFileSync(path.join(process.cwd(), "src/actions/projects.ts"), "utf8");
    assert.match(projectAction, /adoptDeclaredJourneyForProject/);
    assert.match(projectAction, /isMissingJourneySchema/);
  });
});
