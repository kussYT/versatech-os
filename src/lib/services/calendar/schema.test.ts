import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { CalendarItem } from "@/lib/calendar/types";
import { endOfParisDay, startOfParisDay } from "@/lib/dates";
import { mapCalendarItemAgent, mapCalendarList } from "./map";
import {
  LIST_CALENDAR_LIMITS,
  calendarItemAgentSchema,
  calendarListSchema,
  emptyCalendarList,
  inclusiveCivilDayCount,
  isCalendarRangeTooLarge,
  isPlainJsonValue,
  listCalendarItemsInputSchema,
  parseCalendarList,
  parseListCalendarItemsInput,
  requireServiceActor,
  serializeCalendarList,
} from "./schema";

const actor = {
  id: "user_1",
  name: "Marius",
  email: "marius@versatech.example",
  role: "ADMIN" as const,
};

const civilFrom = "2026-09-19";
const civilTo = "2026-09-19";
const parisDayStart = startOfParisDay(civilFrom).toISOString();
const parisDayEnd = endOfParisDay(civilTo).toISOString();

function meetingItem(): CalendarItem {
  return {
    id: "event:evt_rdv",
    kind: "event",
    entityId: "evt_rdv",
    title: "RDV commercial",
    startsAt: "2026-09-19T08:00:00.000Z",
    endsAt: "2026-09-19T09:00:00.000Z",
    allDay: false,
    eventType: "MEETING",
    href: "/entreprises/co_client",
    company: { id: "co_client", name: "ALEX'CEPTION" },
    project: null,
    editable: true,
    overdue: false,
    visitOrder: null,
    visitStatus: null,
    secondaryHref: null,
  };
}

function terrainItem(): CalendarItem {
  return {
    id: "terrain_visit:stop_1",
    kind: "terrain_visit",
    entityId: "stop_1",
    title: "Visite terrain — HL BEAUTY",
    startsAt: parisDayStart,
    endsAt: parisDayEnd,
    allDay: true,
    eventType: null,
    href: "/entreprises/co_hl",
    company: { id: "co_hl", name: "HL BEAUTY" },
    project: null,
    editable: false,
    overdue: false,
    visitOrder: 1,
    visitStatus: "pending",
    secondaryHref: "/tournee",
  };
}

describe("CalendarService listCalendarItems schema", () => {
  test("empty list is valid", () => {
    const empty = emptyCalendarList(civilFrom, civilTo);
    assert.deepEqual(empty.items, []);
    assert.equal(empty.truncated, false);
    assert.equal(calendarListSchema.safeParse(empty).success, true);
  });

  test("JSON roundtrip uses ISO dates and omits href", () => {
    const sample = mapCalendarList([meetingItem(), terrainItem()], civilFrom, civilTo, 30);
    const roundtrip = JSON.parse(JSON.stringify(sample)) as unknown;
    assert.deepEqual(roundtrip, sample);
    assert.deepEqual(parseCalendarList(roundtrip), sample);
    assert.equal(isPlainJsonValue(sample), true);
    const json = serializeCalendarList(sample);
    assert.equal(json.includes('"href"'), false);
    assert.equal(json.includes('"secondaryHref"'), false);
    assert.equal(json.includes('"editable"'), false);
  });

  test("limit default 30 max 50; from > to fails validation", () => {
    assert.equal(LIST_CALENDAR_LIMITS.default, 30);
    assert.equal(LIST_CALENDAR_LIMITS.max, 50);
    assert.equal(parseListCalendarItemsInput({ from: civilFrom, to: civilTo }).limit, 30);
    assert.equal(
      listCalendarItemsInputSchema.safeParse({ from: civilFrom, to: civilTo, limit: 51 }).success,
      false,
    );
    assert.equal(
      listCalendarItemsInputSchema.safeParse({ from: "2026-09-20", to: "2026-09-19" }).success,
      false,
    );
  });

  test("inclusive civil range max 31 days", () => {
    assert.equal(inclusiveCivilDayCount("2026-09-01", "2026-09-01"), 1);
    assert.equal(inclusiveCivilDayCount("2026-09-01", "2026-10-01"), 31);
    assert.equal(isCalendarRangeTooLarge("2026-09-01", "2026-10-01"), false);
    assert.equal(inclusiveCivilDayCount("2026-09-01", "2026-10-02"), 32);
    assert.equal(isCalendarRangeTooLarge("2026-09-01", "2026-10-02"), true);
  });

  test("terrain_visit is distinct from a commercial MEETING event", () => {
    const mapped = mapCalendarList([meetingItem(), terrainItem()], civilFrom, civilTo, 30);
    const meeting = mapped.items.find((item) => item.kind === "event");
    const visit = mapped.items.find((item) => item.kind === "terrain_visit");
    assert.equal(meeting?.eventType, "MEETING");
    assert.equal(meeting?.allDay, false);
    assert.equal(meeting?.visitStatus, null);
    assert.equal(visit?.eventType, null);
    assert.equal(visit?.allDay, true);
    assert.equal(visit?.visitStatus, "pending");
    assert.equal(visit?.visitOrder, 1);
    assert.notEqual(visit?.kind, "event");
    assert.notEqual(meeting?.id, visit?.id);

    assert.equal(
      calendarItemAgentSchema.safeParse({
        ...mapCalendarItemAgent(terrainItem()),
        eventType: "MEETING",
      }).success,
      false,
    );
    assert.equal(
      calendarItemAgentSchema.safeParse({
        ...mapCalendarItemAgent(meetingItem()),
        kind: "terrain_visit",
      }).success,
      false,
    );
  });

  test("href on agent items is rejected", () => {
    const base = mapCalendarItemAgent(meetingItem());
    assert.equal(calendarItemAgentSchema.safeParse({ ...base, href: "/entreprises/x" }).success, false);
  });

  test("requireServiceActor throws when actor id is missing, without redirect", () => {
    assert.throws(() => requireServiceActor({ ...actor, id: "" }), /Acteur requis/);
    assert.throws(() => requireServiceActor(null), /Acteur requis/);
    assert.doesNotThrow(() => requireServiceActor(actor));
  });
});

describe("mapCalendarList", () => {
  test("drops href and marks truncated past limit", () => {
    const items = Array.from({ length: 3 }, (_, index) => ({
      ...meetingItem(),
      id: `event:evt_${index}`,
      entityId: `evt_${index}`,
    }));
    const mapped = mapCalendarList(items, civilFrom, civilTo, 2);
    assert.equal(mapped.truncated, true);
    assert.equal(mapped.returned, 2);
    assert.equal("href" in mapped.items[0]!, false);
  });
});
