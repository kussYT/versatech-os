import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  eachDateKey,
  getMonthGridDays,
  getMonthGridRange,
  isLocalMidnight,
  parseYearMonth,
} from "./calendar/dates";
import {
  defaultFollowUpDueAt,
  dueBucket,
  endOfToday,
  formatDate,
  formatDateTime,
  fromParisDateTime,
  parseDate,
  parseDateTimeLocal,
  parisDateKey,
  parisParts,
  startOfToday,
  toDateInputValue,
  toDateTimeLocalValue,
} from "./dates";

describe("jour civil Europe/Paris", () => {
  it("place minuit été (CEST) au bon instant UTC", () => {
    const start = parseDate("2026-09-16");
    assert.ok(start);
    assert.equal(start.toISOString(), "2026-09-15T22:00:00.000Z");
    assert.equal(parisDateKey(start), "2026-09-16");
  });

  it("place minuit hiver (CET) au bon instant UTC", () => {
    const start = parseDate("2026-01-16");
    assert.ok(start);
    assert.equal(start.toISOString(), "2026-01-15T23:00:00.000Z");
    assert.equal(parisDateKey(start), "2026-01-16");
  });

  it("change de jour civil à minuit Paris, pas à minuit UTC", () => {
    const beforeMidnight = new Date("2026-09-16T21:59:00.000Z");
    const afterMidnight = new Date("2026-09-16T22:00:00.000Z");

    assert.equal(parisDateKey(beforeMidnight), "2026-09-16");
    assert.equal(parisDateKey(afterMidnight), "2026-09-17");
    assert.equal(startOfToday(beforeMidnight).toISOString(), "2026-09-15T22:00:00.000Z");
    assert.equal(startOfToday(afterMidnight).toISOString(), "2026-09-16T22:00:00.000Z");
    assert.equal(endOfToday(beforeMidnight).toISOString(), "2026-09-16T21:59:59.999Z");
    assert.equal(endOfToday(afterMidnight).toISOString(), "2026-09-17T21:59:59.999Z");
  });

  it("change aussi de jour en hiver (CET)", () => {
    const beforeMidnight = new Date("2026-01-15T22:59:00.000Z");
    const afterMidnight = new Date("2026-01-15T23:00:00.000Z");

    assert.equal(parisDateKey(beforeMidnight), "2026-01-15");
    assert.equal(parisDateKey(afterMidnight), "2026-01-16");
    assert.equal(startOfToday(afterMidnight).toISOString(), "2026-01-15T23:00:00.000Z");
  });
});

describe("datetime-local métier Paris", () => {
  it("interprète la saisie naive comme heure de Paris", () => {
    const parsed = parseDateTimeLocal("2026-09-16T09:00");
    assert.ok(parsed);
    assert.equal(parsed.toISOString(), "2026-09-16T07:00:00.000Z");
    assert.equal(toDateTimeLocalValue(parsed), "2026-09-16T09:00");
  });

  it("fait un aller-retour stable autour de minuit Paris", () => {
    const parsed = parseDateTimeLocal("2026-09-17T00:15");
    assert.ok(parsed);
    assert.equal(parsed.toISOString(), "2026-09-16T22:15:00.000Z");
    assert.equal(toDateTimeLocalValue(parsed), "2026-09-17T00:15");
    assert.equal(toDateInputValue(parsed), "2026-09-17");
  });

  it("rejette une date civile invalide", () => {
    assert.equal(parseDate("2026-02-31"), null);
    assert.equal(parseDateTimeLocal("2026-02-31T09:00"), null);
  });
});

describe("formatage utilisateur Paris", () => {
  it("affiche le jour Paris même si l'instant UTC est la veille", () => {
    const instant = new Date("2026-09-16T22:30:00.000Z");
    assert.match(formatDate(instant), /17/);
    assert.match(formatDateTime(instant), /17/);
    assert.doesNotMatch(formatDate(instant), /^16\b/);
  });
});

describe("échéances retard / aujourd'hui / futur", () => {
  it("classe autour de minuit Paris en été", () => {
    const now = new Date("2026-09-16T21:59:00.000Z");
    const overdue = new Date("2026-09-15T21:59:59.999Z");
    const todayLast = new Date("2026-09-16T21:59:59.999Z");
    const tomorrow = new Date("2026-09-16T22:00:00.000Z");

    assert.equal(dueBucket(overdue, now), "overdue");
    assert.equal(dueBucket(todayLast, now), "today");
    assert.equal(dueBucket(tomorrow, now), "upcoming");
  });

  it("fait passer une échéance de aujourd'hui à en retard pile à minuit Paris", () => {
    const dueAt = new Date("2026-09-16T21:30:00.000Z");
    const stillToday = new Date("2026-09-16T21:59:00.000Z");
    const nextDay = new Date("2026-09-16T22:00:00.000Z");

    assert.equal(dueBucket(dueAt, stillToday), "today");
    assert.equal(dueBucket(dueAt, nextDay), "overdue");
  });
});

describe("relance par défaut", () => {
  it("propose demain 09:00 Paris, y compris après minuit UTC", () => {
    const now = new Date("2026-09-16T22:30:00.000Z");
    const due = defaultFollowUpDueAt(now);
    assert.equal(due.toISOString(), "2026-09-18T07:00:00.000Z");
    assert.equal(toDateTimeLocalValue(due), "2026-09-18T09:00");
  });
});

describe("calendrier civil Paris", () => {
  it("associe un événement 22:30 UTC au 17 septembre Paris", () => {
    const keys = eachDateKey("2026-09-16T22:30:00.000Z", "2026-09-16T22:30:00.000Z");
    assert.deepEqual(keys, ["2026-09-17"]);
  });

  it("étend une journée entière Paris sur le bon jour", () => {
    const start = fromParisDateTime(2026, 9, 16, 0, 0, 0, 0);
    const end = fromParisDateTime(2026, 9, 16, 23, 59, 59, 999);
    assert.deepEqual(eachDateKey(start.toISOString(), end.toISOString()), ["2026-09-16"]);
    assert.equal(isLocalMidnight(start), true);
  });

  it("borne la grille mensuelle en instants Paris", () => {
    const range = getMonthGridRange(2026, 8);
    assert.equal(parisDateKey(range.start), getMonthGridDays(2026, 8)[0]?.key);
    assert.equal(parisParts(range.start).hour, 0);
    assert.equal(parisParts(range.end).hour, 23);
    assert.equal(parisParts(range.end).minute, 59);
  });

  it("lit le mois courant selon Paris, pas UTC", () => {
    const { year, month } = parseYearMonth(undefined, new Date("2026-01-01T00:30:00.000Z"));
    assert.equal(year, 2026);
    assert.equal(month, 0);
  });
});
