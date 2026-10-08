import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

describe("company dialogs keep typed values", () => {
  const root = path.resolve(process.cwd());
  const createDialog = readFileSync(
    path.join(root, "src/components/crm/create-prospect-dialog.tsx"),
    "utf8",
  );
  const editDialog = readFileSync(
    path.join(root, "src/components/crm/edit-company-dialog.tsx"),
    "utf8",
  );

  test("create and edit dialogs are controlled and do not use defaultValue", () => {
    for (const source of [createDialog, editDialog]) {
      assert.equal(source.includes("defaultValue"), false);
      assert.match(source, /patchCompanyForm/);
      assert.match(source, /value=\{form\./);
      assert.match(source, /onValue=\{setField\(/);
    }
  });

  test("disclosure fields in the create dialog stay in the same state object", () => {
    assert.match(createDialog, /value=\{form\.address\}/);
    assert.match(createDialog, /value=\{form\.email\}/);
    assert.match(createDialog, /value=\{form\.contactFirstName\}/);
    assert.match(editDialog, /value=\{form\.description\}/);
    assert.match(editDialog, /value=\{form\.contactEmail\}/);
  });
});
