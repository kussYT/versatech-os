import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { emptyTodayOverview, parseTodayOverview } from "@/lib/services/today/schema";

const TOOLS_DIR = path.join(process.cwd(), "src", "ai", "tools");

function readTool(name: string): string {
  return readFileSync(path.join(TOOLS_DIR, name), "utf8");
}

describe("READ tool wiring (no live LLM)", () => {
  test("getTodayOverview imports TodayService and parseTodayOverview accepts the empty DTO", () => {
    const source = readTool("get-today-overview.ts");
    assert.match(source, /TodayService/);
    assert.match(source, /getTodayOverview/);
    assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(source, /@\/actions/);
    const overview = parseTodayOverview(emptyTodayOverview());
    assert.equal(overview.timezone, "Europe/Paris");
    assert.equal(overview.calls.length, 0);
  });

  test("searchCompanies and getCompany import CompanyService", () => {
    const search = readTool("search-companies.ts");
    const company = readTool("get-company.ts");
    assert.match(search, /CompanyService/);
    assert.match(search, /searchCompanies/);
    assert.match(company, /CompanyService/);
    assert.match(company, /getCompany/);
    assert.match(company, /NOT_FOUND/);
  });

  test("listFollowUps imports FollowUpService and does not pass model now", () => {
    const source = readTool("list-follow-ups.ts");
    assert.match(source, /FollowUpService/);
    assert.match(source, /listFollowUps/);
    assert.doesNotMatch(source, /now:\s*input\.now/);
  });

  test("Wave 4 READ tools import their services and never Prisma", () => {
    const files = [
      ["list-tasks.ts", "TaskService"],
      ["list-calendar-items.ts", "CalendarService"],
      ["get-today-tour.ts", "TourService"],
      ["get-pipeline.ts", "OpportunityService"],
      ["get-finance-snapshot.ts", "FinanceService"],
      ["get-recent-activity.ts", "ActivityService"],
    ] as const;
    for (const [file, service] of files) {
      const source = readTool(file);
      assert.match(source, new RegExp(service));
      assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
      assert.doesNotMatch(source, /@\/actions/);
      assert.doesNotMatch(source, /now:\s*input\.now/);
    }
  });

  test("WRITE propose modules do not import Business Services or Prisma", () => {
    for (const file of ["create-follow-up.ts", "complete-follow-up.ts", "create-task.ts", "propose-write.ts"]) {
      const source = readTool(file);
      assert.doesNotMatch(source, /from ["']@\/lib\/services/);
      assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
      assert.doesNotMatch(source, /@\/actions/);
    }
    const confirmed = readTool("execute-confirmed-write.ts");
    assert.match(confirmed, /FollowUpService/);
    assert.match(confirmed, /TaskService/);
    assert.doesNotMatch(confirmed, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(confirmed, /@\/actions/);
  });

  test("webSearch imports WebSearchService and never Prisma or Server Actions", () => {
    const source = readTool("web-search.ts");
    assert.match(source, /WebSearchService/);
    assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(source, /PrismaClient/);
    assert.doesNotMatch(source, /@\/actions/);
  });
});
