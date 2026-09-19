import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TaskListItem } from "@/lib/queries/projects";
import { mapTaskAgent, mapTaskList } from "./map";
import {
  LIST_TASKS_LIMITS,
  emptyTaskList,
  isPlainJsonValue,
  listOpenTasksInputSchema,
  parseListOpenTasksInput,
  parseTaskList,
  requireServiceActor,
  serializeTaskList,
  taskAgentSchema,
  taskListSchema,
  type TaskListDto,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

function sampleItem(): TaskListItem {
  return {
    id: "task_1",
    title: "Préparer maquette",
    dueAt: "2026-09-19T16:00:00.000Z",
    priority: "NORMAL",
    status: "TODO",
    project: { id: "proj_1", name: "Site vitrine" },
    company: { id: "co_lead", name: "Atelier Nord" },
  };
}

function sampleList(overrides: Partial<TaskListDto> = {}): TaskListDto {
  return parseTaskList({
    items: [
      {
        id: "task_1",
        title: "Préparer maquette",
        dueAt: "2026-09-19T16:00:00.000Z",
        priority: "NORMAL",
        status: "TODO",
        project: { id: "proj_1", name: "Site vitrine" },
        company: { id: "co_lead", name: "Atelier Nord" },
      },
    ],
    returned: 1,
    limit: 15,
    ...overrides,
  });
}

describe("TaskService listOpenTasks schema", () => {
  test("empty list is valid", () => {
    const empty = emptyTaskList();
    assert.deepEqual(empty.items, []);
    assert.equal(empty.returned, 0);
    assert.equal(empty.limit, LIST_TASKS_LIMITS.default);
    assert.equal(taskListSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip uses ISO dates and omits description/href", () => {
    const sample = sampleList();
    const roundtrip = JSON.parse(JSON.stringify(sample)) as unknown;
    assert.deepEqual(roundtrip, sample);
    assert.deepEqual(parseTaskList(roundtrip), sample);
    assert.equal(isPlainJsonValue(sample), true);
    const json = serializeTaskList(sample);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes('"description"'), false);
    assert.match(sample.items[0]!.dueAt!, /^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  test("limit default 15 max 30; oversized items fail", () => {
    assert.equal(LIST_TASKS_LIMITS.default, 15);
    assert.equal(LIST_TASKS_LIMITS.max, 30);
    assert.equal(parseListOpenTasksInput({}).limit, 15);
    assert.equal(listOpenTasksInputSchema.safeParse({ limit: 31 }).success, false);
    assert.equal(listOpenTasksInputSchema.safeParse({ dueBucket: "later" }).success, false);
    assert.equal(listOpenTasksInputSchema.safeParse({ companyId: "" }).success, false);

    const tooMany = {
      items: Array.from({ length: 31 }, (_, index) => ({
        id: `task_${index}`,
        title: "Tâche",
        dueAt: null,
        priority: "NORMAL" as const,
        status: "TODO" as const,
        project: null,
        company: null,
      })),
      returned: 31,
      limit: 30,
    };
    assert.equal(taskListSchema.safeParse(tooMany).success, false);
  });

  test("description, href and DONE status are rejected", () => {
    const base = sampleList().items[0]!;
    assert.equal(taskAgentSchema.safeParse({ ...base, description: "secret" }).success, false);
    assert.equal(taskAgentSchema.safeParse({ ...base, href: "/projets/proj_1" }).success, false);
    assert.equal(taskAgentSchema.safeParse({ ...base, status: "DONE" }).success, false);
  });

  test("Date objects are rejected", () => {
    const sample = sampleList();
    assert.equal(
      taskListSchema.safeParse({
        ...sample,
        items: [{ ...sample.items[0]!, dueAt: new Date("2026-09-19T16:00:00.000Z") }],
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

describe("mapTaskList", () => {
  test("keeps ISO dueAt and company/project ids", () => {
    const mapped = mapTaskList([sampleItem()], 15);
    assert.equal(mapped.returned, 1);
    assert.equal(mapped.items[0]?.title, "Préparer maquette");
    assert.equal(mapped.items[0]?.dueAt, "2026-09-19T16:00:00.000Z");
    assert.deepEqual(Object.keys(mapped.items[0]!.company!).sort(), ["id", "name"]);
  });

  test("clamp respects limit", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...sampleItem(),
      id: `task_${index}`,
    }));
    const mapped = mapTaskList(items, 3);
    assert.equal(mapped.items.length, 3);
    assert.equal(mapped.returned, 3);
  });

  test("mapTaskAgent never copies description", () => {
    const agent = mapTaskAgent(sampleItem());
    assert.equal("description" in agent, false);
    assert.equal("href" in agent, false);
  });
});
