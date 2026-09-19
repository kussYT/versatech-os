/**
 * POST /api/ai/actions/confirm body contract (ADR-014).
 * Never execute `{ toolName, args }` from the client. The LLM cannot confirm.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import {
  confirmActionBodySchema,
  extractConfirmToken,
} from "@/ai/confirmation";
import { isPublicPath } from "@/lib/auth/paths";

const CONFIRM_ROUTE = path.join(
  process.cwd(),
  "src",
  "app",
  "api",
  "ai",
  "actions",
  "confirm",
  "route.ts",
);
const EXECUTE_ROUTE = path.join(process.cwd(), "src", "app", "api", "ai", "execute");
const PATHS_FILE = path.join(process.cwd(), "src", "lib", "auth", "paths.ts");

describe("POST /api/ai/actions/confirm route contract", () => {
  test("is Node POST-only, uses requireRequestActor, and is not a public path", () => {
    assert.equal(existsSync(CONFIRM_ROUTE), true);
    assert.equal(existsSync(EXECUTE_ROUTE), false);
    assert.equal(existsSync(path.join(process.cwd(), "src", "app", "api", "ai", "execute", "route.ts")), false);

    const source = readFileSync(CONFIRM_ROUTE, "utf8");
    assert.match(source, /export const runtime = ["']nodejs["']/);
    assert.match(source, /export async function POST/);
    assert.doesNotMatch(source, /export async function GET/);
    assert.match(source, /requireRequestActor/);
    assert.match(source, /handleConfirmActionRequest/);
    assert.doesNotMatch(source, /\bredirect\s*\(/);
    assert.doesNotMatch(source, /createNextRouteHandler/);
    assert.doesNotMatch(source, /isPublicPath/);
    assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(source, /PrismaClient/);
    assert.doesNotMatch(source, /@\/actions/);
    assert.doesNotMatch(source, /body\.toolName/);
    assert.doesNotMatch(source, /OPENAI_API_KEY/);

    assert.equal(
      existsSync(path.join(process.cwd(), "src", "ai", "confirmation", "consumed.ts")),
      false,
    );
    const confirmSource = readFileSync(
      path.join(process.cwd(), "src", "ai", "confirmation", "confirm.ts"),
      "utf8",
    );
    const executeSource = readFileSync(
      path.join(process.cwd(), "src", "ai", "confirmation", "execute.ts"),
      "utf8",
    );
    assert.doesNotMatch(confirmSource, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(executeSource, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(confirmSource, /PrismaClient/);
    assert.doesNotMatch(executeSource, /PrismaClient/);
    assert.match(confirmSource, /claimAiActionConsumption/);

    assert.equal(isPublicPath("/api/ai"), false);
    assert.equal(isPublicPath("/api/ai/actions/confirm"), false);
    const pathsSource = readFileSync(PATHS_FILE, "utf8");
    assert.doesNotMatch(pathsSource, /api\/ai/);
  });
});

describe("confirm action body schema", () => {
  test("accepts { token } only and never treats confirmed:true or confirmation wrappers as a token", () => {
    const fromToken = confirmActionBodySchema.safeParse({ token: " signed.jwt.value " });
    assert.equal(fromToken.success, true);
    if (fromToken.success) {
      assert.equal(extractConfirmToken(fromToken.data), "signed.jwt.value");
    }

    const fromString = confirmActionBodySchema.safeParse({ confirmation: "abc.def.ghi" });
    assert.equal(fromString.success, false);

    const fromObject = confirmActionBodySchema.safeParse({ confirmation: { token: "abc.def.ghi" } });
    assert.equal(fromObject.success, false);

    const modelConfirm = confirmActionBodySchema.safeParse({ confirmed: true });
    assert.equal(modelConfirm.success, false);

    const executeShape = confirmActionBodySchema.safeParse({
      toolName: "createFollowUp",
      args: { companyId: "co_x", dueAt: "2026-09-20T08:00:00.000Z" },
      confirmed: true,
    });
    assert.equal(executeShape.success, false);

    const tokenPlusExecute = confirmActionBodySchema.safeParse({
      token: "opaque.jwt.value",
      toolName: "createPayment",
      args: { quoteId: "q_1" },
      confirmed: true,
    });
    assert.equal(tokenPlusExecute.success, true);
    if (tokenPlusExecute.success) {
      assert.equal(extractConfirmToken(tokenPlusExecute.data), "opaque.jwt.value");
      assert.equal("toolName" in tokenPlusExecute.data, false);
      assert.equal("args" in tokenPlusExecute.data, false);
      assert.equal("confirmed" in tokenPlusExecute.data, false);
    }
  });
});
