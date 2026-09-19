import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth/types";
import { createTask, updateTaskStatus, type TaskWriteStore } from "./write";
import {
  canTransitionTask,
  classifyTaskAnchor,
  companyScopedTaskLinks,
  projectScopedTaskLinks,
} from "./write-rules";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  PROJECT_NOT_FOUND_MESSAGE,
  TASK_ANCHOR_REQUIRED_MESSAGE,
  TASK_NOT_FOUND_MESSAGE,
  TASK_PROJECT_COMPANY_MISMATCH_MESSAGE,
  TASK_TRANSITION_NOT_ALLOWED_MESSAGE,
  createTaskInputSchema,
} from "./schema";

const actor: SessionUser = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN",
};

describe("task write rules", () => {
  test("company-only anchor never invents a project", () => {
    assert.deepEqual(classifyTaskAnchor(null, "co_atelier"), {
      kind: "company",
      companyId: "co_atelier",
    });
    assert.deepEqual(companyScopedTaskLinks("co_atelier"), {
      companyId: "co_atelier",
      projectId: null,
      opportunityId: null,
    });
  });

  test("project id wins and copies company from the project", () => {
    assert.deepEqual(classifyTaskAnchor("proj_site", "co_atelier"), {
      kind: "project",
      projectId: "proj_site",
      requestedCompanyId: "co_atelier",
    });
    const ok = projectScopedTaskLinks(
      { id: "proj_site", companyId: "co_atelier", opportunityId: "opp_1" },
      "co_atelier",
    );
    assert.deepEqual(ok, {
      ok: true,
      links: { companyId: "co_atelier", projectId: "proj_site", opportunityId: "opp_1" },
    });
  });

  test("mismatched companyId / project.companyId is rejected", () => {
    const result = projectScopedTaskLinks(
      { id: "proj_site", companyId: "co_atelier", opportunityId: null },
      "co_other",
    );
    assert.deepEqual(result, {
      ok: false,
      message: TASK_PROJECT_COMPANY_MISMATCH_MESSAGE,
    });
  });

  test("DONE and CANCELED are terminal", () => {
    assert.equal(canTransitionTask("TODO", "IN_PROGRESS"), true);
    assert.equal(canTransitionTask("IN_PROGRESS", "DONE"), true);
    assert.equal(canTransitionTask("DONE", "TODO"), false);
    assert.equal(canTransitionTask("CANCELED", "TODO"), false);
  });
});

function createStore(seed: {
  projects?: Record<string, { id: string; companyId: string; opportunityId: string | null }>;
  companies?: Record<string, { id: string }>;
  tasks?: Record<
    string,
    {
      id: string;
      status: "TODO" | "IN_PROGRESS" | "DONE" | "CANCELED";
      completedAt: Date | null;
      projectId: string | null;
      companyId: string | null;
    }
  >;
}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];
  let projectLookups = 0;
  let companyLookups = 0;

  const store: TaskWriteStore = {
    project: {
      findUnique: async ({ where }) => {
        projectLookups += 1;
        return seed.projects?.[where.id] ?? null;
      },
    },
    company: {
      findUnique: async ({ where }) => {
        companyLookups += 1;
        return seed.companies?.[where.id] ?? null;
      },
    },
    task: {
      findUnique: async ({ where }) => seed.tasks?.[where.id] ?? null,
    },
    $transaction: async (fn) =>
      fn({
        task: {
          create: async ({ data }) => {
            const row = { id: "task_created", ...data };
            created.push(row);
            return { id: row.id };
          },
          update: async ({ where, data }) => {
            updated.push({ id: where.id, ...data });
            return data;
          },
        },
        activityLog: {
          create: async ({ data }) => {
            logs.push(data);
            return data;
          },
        },
      }),
  };

  return { store, created, updated, logs, lookups: { projectLookups, companyLookups: () => companyLookups, projectLookupsFn: () => projectLookups } };
}

describe("TaskService.createTask", () => {
  test("project-scoped task copies companyId and opportunityId from the project", async () => {
    const { store, created, logs, lookups } = createStore({
      projects: {
        proj_site: { id: "proj_site", companyId: "co_atelier", opportunityId: "opp_1" },
      },
    });

    const result = await createTask(
      {
        actor,
        title: "Préparer maquette",
        projectId: "proj_site",
        priority: "HIGH",
      },
      { store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.deepEqual(result.data, {
      taskId: "task_created",
      projectId: "proj_site",
      companyId: "co_atelier",
    });
    assert.equal(created[0]?.companyId, "co_atelier");
    assert.equal(created[0]?.projectId, "proj_site");
    assert.equal(created[0]?.opportunityId, "opp_1");
    assert.equal(created[0]?.status, "TODO");
    assert.equal(created[0]?.assignedToId, actor.id);
    assert.equal(created[0]?.priority, "HIGH");
    assert.deepEqual(logs[0]?.metadata, { projectId: "proj_site", companyId: "co_atelier" });
    assert.equal(lookups.projectLookupsFn(), 1);
  });

  test("company-level task persists companyId without inventing a project", async () => {
    const { store, created, logs, lookups } = createStore({
      companies: { co_atelier: { id: "co_atelier" } },
      projects: {
        proj_principal: { id: "proj_principal", companyId: "co_atelier", opportunityId: "opp_hidden" },
      },
    });

    const result = await createTask(
      { actor, title: "Rappeler Jacques", companyId: "co_atelier" },
      { store },
    );

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.taskId, "task_created");
    assert.equal(result.data.companyId, "co_atelier");
    assert.equal("projectId" in result.data, false);
    assert.equal(created[0]?.companyId, "co_atelier");
    assert.equal(created[0]?.projectId, null);
    assert.equal(created[0]?.opportunityId, null);
    assert.deepEqual(logs[0]?.metadata, { companyId: "co_atelier" });
    assert.equal(JSON.stringify(created[0]).includes("proj_principal"), false);
    assert.equal(lookups.projectLookupsFn(), 0);
    assert.equal(lookups.companyLookups(), 1);
  });

  test("both ids keep project rules when the project belongs to the company", async () => {
    const { store, created } = createStore({
      projects: {
        proj_site: { id: "proj_site", companyId: "co_atelier", opportunityId: "opp_1" },
      },
      companies: { co_atelier: { id: "co_atelier" } },
    });
    const result = await createTask(
      { actor, title: "Livrable", projectId: "proj_site", companyId: "co_atelier" },
      { store },
    );
    assert.equal(result.ok, true);
    assert.equal(created[0]?.projectId, "proj_site");
    assert.equal(created[0]?.companyId, "co_atelier");
    assert.equal(created[0]?.opportunityId, "opp_1");
  });

  test("both ids reject a project that belongs to another company", async () => {
    const { store, created } = createStore({
      projects: {
        proj_site: { id: "proj_site", companyId: "co_atelier", opportunityId: null },
      },
    });
    const result = await createTask(
      { actor, title: "Livrable", projectId: "proj_site", companyId: "co_other" },
      { store },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "CONFLICT");
    assert.equal(result.message, TASK_PROJECT_COMPANY_MISMATCH_MESSAGE);
    assert.equal(created.length, 0);
  });

  test("neither company nor project is VALIDATION", async () => {
    const parsed = createTaskInputSchema.safeParse({ title: "Sans ancre" });
    assert.equal(parsed.success, false);
    const result = await createTask({ actor, title: "Sans ancre" }, { store: createStore({}).store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "VALIDATION");
    assert.equal(result.message, "Vérifiez les champs du formulaire.");
    assert.ok(result.fieldErrors?.companyId?.includes(TASK_ANCHOR_REQUIRED_MESSAGE));
  });

  test("unknown project / company are NOT_FOUND", async () => {
    const missingProject = await createTask(
      { actor, title: "X", projectId: "proj_missing" },
      { store: createStore({}).store },
    );
    assert.equal(missingProject.ok, false);
    if (!missingProject.ok) {
      assert.equal(missingProject.code, "NOT_FOUND");
      assert.equal(missingProject.message, PROJECT_NOT_FOUND_MESSAGE);
    }

    const missingCompany = await createTask(
      { actor, title: "X", companyId: "co_missing" },
      { store: createStore({}).store },
    );
    assert.equal(missingCompany.ok, false);
    if (!missingCompany.ok) {
      assert.equal(missingCompany.code, "NOT_FOUND");
      assert.equal(missingCompany.message, COMPANY_NOT_FOUND_MESSAGE);
    }
  });

  test("defaults priority to NORMAL and optional source=ai", async () => {
    const { store, created, logs } = createStore({
      companies: { co_atelier: { id: "co_atelier" } },
    });
    const result = await createTask(
      { actor, title: "Note", companyId: "co_atelier", source: "ai" },
      { store },
    );
    assert.equal(result.ok, true);
    assert.equal(created[0]?.priority, "NORMAL");
    assert.deepEqual(logs[0]?.metadata, { companyId: "co_atelier", source: "ai" });
    assert.equal(JSON.stringify(logs[0]).includes("prompt"), false);
  });
});

describe("TaskService.updateTaskStatus", () => {
  test("IN_PROGRESS → DONE sets completedAt and journals the transition", async () => {
    const now = new Date("2026-09-19T15:00:00.000Z");
    const { store, updated, logs } = createStore({
      tasks: {
        task_1: {
          id: "task_1",
          status: "IN_PROGRESS",
          completedAt: null,
          projectId: "proj_site",
          companyId: "co_atelier",
        },
      },
    });
    const result = await updateTaskStatus(
      { actor, taskId: "task_1", status: "DONE" },
      { store, now },
    );
    assert.equal(result.ok, true);
    assert.deepEqual(updated[0], { id: "task_1", status: "DONE", completedAt: now });
    assert.equal(logs[0]?.action, "task.status_changed");
    assert.deepEqual(logs[0]?.metadata, {
      projectId: "proj_site",
      fromStatus: "IN_PROGRESS",
      toStatus: "DONE",
    });
  });

  test("same status is a no-op", async () => {
    const { store, updated, logs } = createStore({
      tasks: {
        task_1: {
          id: "task_1",
          status: "TODO",
          completedAt: null,
          projectId: null,
          companyId: "co_atelier",
        },
      },
    });
    const result = await updateTaskStatus({ actor, taskId: "task_1", status: "TODO" }, { store });
    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(result.data.companyId, "co_atelier");
    assert.equal("projectId" in result.data, false);
    assert.equal(updated.length, 0);
    assert.equal(logs.length, 0);
  });

  test("illegal transition is CONFLICT", async () => {
    const { store, updated } = createStore({
      tasks: {
        task_1: {
          id: "task_1",
          status: "DONE",
          completedAt: new Date(),
          projectId: "proj_site",
          companyId: "co_atelier",
        },
      },
    });
    const result = await updateTaskStatus({ actor, taskId: "task_1", status: "TODO" }, { store });
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "CONFLICT");
    assert.equal(result.message, TASK_TRANSITION_NOT_ALLOWED_MESSAGE);
    assert.equal(updated.length, 0);
  });

  test("unknown task is NOT_FOUND", async () => {
    const result = await updateTaskStatus(
      { actor, taskId: "task_missing", status: "DONE" },
      { store: createStore({}).store },
    );
    assert.equal(result.ok, false);
    if (result.ok) {
      return;
    }
    assert.equal(result.code, "NOT_FOUND");
    assert.equal(result.message, TASK_NOT_FOUND_MESSAGE);
  });
});

describe("optional shared tx", () => {
  test("createTask uses the passed tx and does not open a nested $transaction", async () => {
    const created: Array<Record<string, unknown>> = [];
    const logs: Array<Record<string, unknown>> = [];
    let nested = 0;
    const { store } = createStore({
      companies: { co_atelier: { id: "co_atelier" } },
    });
    store.$transaction = async (fn) => {
      nested += 1;
      return fn({
        task: {
          create: async ({ data }) => {
            created.push({ id: "nested", ...data });
            return { id: "nested" };
          },
          update: async () => ({}),
        },
        activityLog: {
          create: async ({ data }) => {
            logs.push(data);
            return data;
          },
        },
      });
    };

    const tx = {
      project: store.project,
      company: store.company,
      task: {
        findUnique: store.task.findUnique,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push({ id: "task_shared", ...data });
          return { id: "task_shared" };
        },
        update: async () => ({}),
      },
      activityLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          logs.push(data);
          return data;
        },
      },
    } as unknown as Prisma.TransactionClient;

    const result = await createTask({ actor, title: "Note", companyId: "co_atelier" }, { tx });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.taskId, "task_shared");
    }
    assert.equal(nested, 0);
    assert.equal(created[0]?.id, "task_shared");
    assert.equal(logs[0]?.action, "task.created");
  });
});
