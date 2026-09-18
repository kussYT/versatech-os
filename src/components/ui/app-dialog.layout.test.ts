import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

describe("layout des dialogs partagés", () => {
  const root = path.resolve(process.cwd());
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const dialog = readFileSync(path.join(root, "src/components/ui/app-dialog.tsx"), "utf8");

  test("keeps the header outside the scroll area and scrolls the body", () => {
    assert.match(dialog, /vt-dialog-header/);
    assert.match(dialog, /vt-dialog-body/);
    assert.match(css, /\.vt-dialog-header[\s\S]*flex-shrink:\s*0/);
    assert.match(css, /\.vt-dialog-body[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /\.vt-dialog[\s\S]*overflow:\s*hidden/);
  });

  test("caps height with dvh/svh and keeps actions above the safe area", () => {
    assert.match(css, /100dvh/);
    assert.match(css, /100svh/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(css, /:last-child:has\(\[type="submit"\]\)/);
    assert.match(css, /overflow-x:\s*hidden/);
  });
});
