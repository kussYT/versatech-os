import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "generated" || entry === "node_modules") {
        continue;
      }
      found.push(...sourceFiles(full));
      continue;
    }
    if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

describe("won stage gate", () => {
  test("only the stage service assigns WON", () => {
    const root = path.join(process.cwd(), "src");
    const offenders: string[] = [];
    for (const file of sourceFiles(root)) {
      if (file.endsWith(".test.ts") || file.endsWith(`${path.sep}stage.ts`)) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      if (text.includes("opportunity.update(")) {
        offenders.push(path.relative(root, file));
      }
    }
    assert.deepEqual(offenders, []);
    const quotesAction = readFileSync(path.join(root, "actions", "quotes.ts"), "utf8");
    assert.equal(quotesAction.includes('stage: "WON"'), false);
    assert.equal(quotesAction.includes('toStage: "WON"'), false);
    const quoteService = readFileSync(path.join(root, "lib", "services", "quotes", "status.ts"), "utf8");
    assert.match(quoteService, /applyOpportunityStageChange/);
  });
});
