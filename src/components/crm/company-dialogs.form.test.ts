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

  test("create dialog keeps express UX: name first, extras collapsed, duplicate search", () => {
    assert.match(createDialog, /Seul le nom est obligatoire/);
    assert.match(createDialog, /Plus d&apos;informations|Plus d'informations/);
    assert.match(createDialog, /searchProspectDuplicates/);
    assert.match(createDialog, /Créer quand même/);
    assert.match(createDialog, /Ouvrir cette entreprise/);
    // Optional fields must live under the collapsed section, not above it.
    const moreMarker = createDialog.indexOf("prospect-more-info");
    const instagramField = createDialog.indexOf('id="prospect-instagram"');
    const sourceField = createDialog.indexOf('id="prospect-source"');
    assert.ok(moreMarker > 0);
    assert.ok(instagramField > moreMarker);
    assert.ok(sourceField > moreMarker);
  });
});

