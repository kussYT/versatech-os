import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  serviceFail,
  serviceOk,
  toActionResult,
  withActivitySource,
} from "./result";

describe("ServiceResult", () => {
  test("toActionResult maps ok data and fieldErrors without leaking secrets", () => {
    const ok = toActionResult(serviceOk({ followUpId: "fu_1", companyId: "co_1" }));
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.data, { followUpId: "fu_1", companyId: "co_1" });

    const fail = toActionResult(
      serviceFail("VALIDATION", "Vérifiez les champs du formulaire.", {
        title: ["Le titre est obligatoire"],
      }),
    );
    assert.equal(fail.ok, false);
    assert.equal(fail.message, "Vérifiez les champs du formulaire.");
    assert.deepEqual(fail.fieldErrors, { title: ["Le titre est obligatoire"] });
    assert.equal(JSON.stringify(fail).includes("DATABASE_URL"), false);
  });

  test("withActivitySource adds source=ai without chat text", () => {
    const base = { companyId: "co_1" };
    assert.deepEqual(withActivitySource(base), { companyId: "co_1" });
    assert.deepEqual(withActivitySource(base, "ai"), { companyId: "co_1", source: "ai" });
    const json = JSON.stringify(withActivitySource(base, "ai"));
    assert.equal(json.includes("prompt"), false);
    assert.equal(json.includes("chat"), false);
  });
});
