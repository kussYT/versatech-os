import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapGoogleEventToLocal,
  mapLocalMeetingToGoogleBody,
} from "@/lib/integrations/google/map-event";

describe("mapGoogleEventToLocal", () => {
  it("maps a timed Google event with absolute instants", () => {
    const mapped = mapGoogleEventToLocal({
      id: "evt_1",
      summary: "Kickoff",
      start: { dateTime: "2026-10-21T08:00:00+02:00", timeZone: "Europe/Paris" },
      end: { dateTime: "2026-10-21T09:00:00+02:00", timeZone: "Europe/Paris" },
      htmlLink: "https://calendar.google.com/event?eid=1",
    });

    assert.ok(mapped);
    assert.equal(mapped.externalProvider, "google");
    assert.equal(mapped.externalId, "evt_1");
    assert.equal(mapped.title, "Kickoff");
    assert.equal(mapped.allDay, false);
    assert.equal(mapped.cancelled, false);
    assert.equal(mapped.startsAt.toISOString(), "2026-10-21T06:00:00.000Z");
    assert.equal(mapped.endsAt.toISOString(), "2026-10-21T07:00:00.000Z");
  });

  it("maps an all-day Google event to Paris day bounds (exclusive end)", () => {
    const mapped = mapGoogleEventToLocal({
      id: "evt_day",
      summary: "Congé",
      start: { date: "2026-10-22" },
      end: { date: "2026-10-23" },
    });

    assert.ok(mapped);
    assert.equal(mapped.allDay, true);
    assert.equal(mapped.startsAt.toISOString().endsWith("T22:00:00.000Z") || mapped.startsAt.toISOString().endsWith("T23:00:00.000Z"), true);
  });

  it("marks cancelled events", () => {
    const mapped = mapGoogleEventToLocal({
      id: "evt_x",
      status: "cancelled",
      start: { dateTime: "2026-10-21T10:00:00Z" },
      end: { dateTime: "2026-10-21T11:00:00Z" },
    });
    assert.ok(mapped);
    assert.equal(mapped.cancelled, true);
  });
});

describe("mapLocalMeetingToGoogleBody", () => {
  it("pushes timed meetings with Europe/Paris timezone by default", () => {
    const body = mapLocalMeetingToGoogleBody({
      title: "RDV client",
      startsAt: new Date("2026-10-21T08:00:00.000Z"),
      endsAt: new Date("2026-10-21T09:00:00.000Z"),
      allDay: false,
    });

    assert.equal(body.summary, "RDV client");
    assert.deepEqual(body.start, {
      dateTime: "2026-10-21T08:00:00.000Z",
      timeZone: "Europe/Paris",
    });
    assert.deepEqual(body.reminders, { useDefault: true });
  });

  it("uses exclusive end date for all-day meetings", () => {
    const body = mapLocalMeetingToGoogleBody({
      title: "Journée",
      startsAt: new Date("2026-10-21T22:00:00.000Z"),
      endsAt: new Date("2026-10-22T21:59:59.999Z"),
      allDay: true,
    });

    assert.ok("date" in (body.start as object));
    assert.ok("date" in (body.end as object));
    const start = body.start as { date: string };
    const end = body.end as { date: string };
    assert.equal(start.date, "2026-10-22");
    assert.equal(end.date, "2026-10-23");
  });
});
