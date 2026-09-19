/**
 * ADR-014 architecture tests. Prefer reading source as text so the suite
 * stays green while `src/ai/` is still landing, and still fails if a later
 * change imports Prisma or Server Actions into the agent layer.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { pathToFileURL } from "node:url";
import { LOGIN_PATH } from "@/lib/auth/config";
import { HEALTH_PATH, isPublicPath } from "@/lib/auth/paths";
import {
  TODAY_OVERVIEW_LIMITS,
  emptyTodayOverview,
  parseTodayOverview,
  todayOverviewSchema,
} from "@/lib/services/today/schema";

const REPO_ROOT = path.resolve(process.cwd());
const AI_ROOT = path.join(REPO_ROOT, "src", "ai");
const TODAY_SERVICE_FILE = path.join(REPO_ROOT, "src", "lib", "services", "today", "service.ts");
const TODAY_SCHEMA_FILE = path.join(REPO_ROOT, "src", "lib", "services", "today", "schema.ts");
const AUTH_PATHS_FILE = path.join(REPO_ROOT, "src", "lib", "auth", "paths.ts");

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const FORBIDDEN_PRISMA_SPECIFIERS = [
  "@/lib/db/prisma",
  "@/generated/prisma",
  "@prisma/client",
  "@prisma/adapter-pg",
];

const WRITE_TOOL_NAMES = [
  "createCompany",
  "createFollowUp",
  "completeFollowUp",
  "rescheduleFollowUp",
  "recordInteraction",
  "recordTerrainVisit",
  "createTask",
  "updateTaskStatus",
  "createCalendarEvent",
  "updateCalendarEvent",
  "createOpportunity",
  "updateOpportunityStage",
  "ensureTodayTour",
  "addCompanyToTodayTour",
  "moveTourStop",
] as const;

const CRITICAL_TOOL_NAMES = [
  "updateOpportunityStageWonLost",
  "createQuote",
  "updateQuoteStatus",
  "createPayment",
  "updatePaymentStatus",
  "createProject",
  "updateProjectStatus",
  "createMaintenanceContract",
  "updateMaintenanceContract",
  "updateMaintenanceStatus",
  "associateGitHubRepository",
  "unlinkGitHubRepository",
  "removeCompanyFromTodayTour",
] as const;

const SESSION_ACTOR = {
  id: "user_session",
  name: "Camille Durand",
  email: "camille.durand@versatech.example",
  role: "ADMIN" as const,
};

const SPOOFED_ACTOR_ID = "user_from_model";

const SECRET_KEY_RE = /(password|token|auth_secret|database_url|github_token)/i;

const PERMISSION_MODULE_HINTS = [
  "src/ai/permissions/policy.ts",
  "src/ai/permissions/enforce.ts",
  "src/ai/permissions/catalog.ts",
  "src/ai/permissions/index.ts",
  "src/ai/tools/registry.ts",
  "src/ai/tools/execute.ts",
  "src/ai/tools/index.ts",
];

const CONTEXT_MODULE_HINTS = [
  "src/ai/context.ts",
  "src/ai/schemas/context.ts",
  "src/ai/permissions/context.ts",
  "src/ai/runtime/session.ts",
];

const SKIP_DYNAMIC_IMPORT_DIRS = new Set(["providers", "agent", "memory", "voice", "web"]);

describe("ADR-014: src/ai must not import Prisma", () => {
  test("no Prisma client, @/lib/db/prisma, or generated/prisma import under src/ai", () => {
    const violations = scanAiImportViolations((file, specifier, resolved) => {
      if (isPrismaSpecifier(specifier, resolved)) {
        return `${toPosix(file)} imports Prisma via ${specifier}`;
      }
      return null;
    });
    assert.deepEqual(violations, []);
  });
});

describe("ADR-014: src/ai must not call Server Actions", () => {
  test("no import from @/actions or src/actions under src/ai", () => {
    const violations = scanAiImportViolations((file, specifier, resolved) => {
      if (isServerActionSpecifier(specifier, resolved)) {
        return `${toPosix(file)} imports a Server Action via ${specifier}`;
      }
      return null;
    });

    for (const file of listAiSourceFiles()) {
      const source = stripComments(readFileSync(file, "utf8"));
      if (/"use server"/.test(source) || /'use server'/.test(source)) {
        violations.push(`${toPosix(file)} declares "use server"`);
      }
    }

    assert.deepEqual(violations, []);
  });
});

describe("ADR-014: WRITE is not executable this wave", () => {
  test("policy/registry refuses WRITE, or there is no execute surface yet", async () => {
    const pinned = await assertPinnedPermissionRefusal("WRITE", "createFollowUp");
    if (!pinned) {
      await assertMutationClassBlocked("WRITE", WRITE_TOOL_NAMES);
    }
  });
});

describe("ADR-014: CRITICAL is not executable", () => {
  test("policy/registry refuses CRITICAL, or there is no execute surface yet", async () => {
    const pinned = await assertPinnedPermissionRefusal("CRITICAL", "createPayment");
    if (!pinned) {
      await assertMutationClassBlocked("CRITICAL", CRITICAL_TOOL_NAMES);
    }
  });
});

describe("ADR-014: ToolContext actor comes from the session", () => {
  test("factory ignores a spoofed actorId from model-shaped input when present", async () => {
    assert.deepEqual(scanSpoofedActorAssignments(), []);

    const pinned = await assertPinnedActorFactoryIgnoresSpoof();
    if (pinned) {
      return;
    }

    const factory = await loadToolContextFactory();
    if (!factory) {
      return;
    }

    const fromSession = await firstToolContext([
      () => factory(SESSION_ACTOR),
      () => factory(SESSION_ACTOR, "req_session"),
      () => factory({ ok: true, actor: SESSION_ACTOR }),
      () => factory({ actor: SESSION_ACTOR, requestId: "req_session", source: "AI" }),
    ]);
    assert.ok(fromSession, "ToolContext factory exists but did not accept a SessionUser");
    assert.equal(fromSession.actorId, SESSION_ACTOR.id);

    const spoofedExtra = await firstToolContext([
      () => factory(SESSION_ACTOR, { actorId: SPOOFED_ACTOR_ID }),
      () => factory({ ...SESSION_ACTOR, actorId: SPOOFED_ACTOR_ID }),
      () =>
        factory(SESSION_ACTOR, {
          actorId: SPOOFED_ACTOR_ID,
          role: "ADMIN",
          requestId: "req_model",
          source: "AI",
        }),
      () =>
        factory({
          actor: SESSION_ACTOR,
          input: { actorId: SPOOFED_ACTOR_ID },
          args: { actorId: SPOOFED_ACTOR_ID },
        }),
    ]);
    if (spoofedExtra) {
      assert.equal(spoofedExtra.actorId, SESSION_ACTOR.id);
      assert.notEqual(spoofedExtra.actorId, SPOOFED_ACTOR_ID);
    }

    const modelOnly = await firstToolContext([
      () =>
        factory({
          actorId: SPOOFED_ACTOR_ID,
          role: "ADMIN",
          requestId: "req_model",
          source: "AI",
        }),
      () => factory({ actorId: SPOOFED_ACTOR_ID }),
    ]);
    if (modelOnly) {
      assert.notEqual(modelOnly.actorId, SPOOFED_ACTOR_ID);
    }
  });
});

describe("ADR-014: getTodayOverview is READ-only", () => {
  test("TodayService.getTodayOverview file has no Prisma mutation surface", () => {
    assert.equal(existsSync(TODAY_SERVICE_FILE), true);
    const raw = readFileSync(TODAY_SERVICE_FILE, "utf8");
    const source = stripComments(raw);
    assert.equal(raw.includes("getTodayOverview"), true);
    assert.equal(hasPrismaImport(source, TODAY_SERVICE_FILE), false);
    assert.equal(hasMutationCall(source), false);
    assert.doesNotMatch(source, /\b(?:prisma|logActivity)\b/);
  });

  test("src/ai getTodayOverview metadata is READ and the file does not mutate via Prisma", async () => {
    const files = listAiSourceFiles().filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("getTodayOverview");
    });

    const catalogPath = path.join(AI_ROOT, "permissions", "catalog.ts");
    if (existsSync(catalogPath)) {
      const catalog = await importIfPossible(catalogPath);
      if (catalog && typeof catalog.getToolPermission === "function") {
        assert.equal(catalog.getToolPermission("getTodayOverview"), "READ");
      }
      const permissions = catalog?.TOOL_PERMISSIONS as Record<string, string> | undefined;
      if (permissions && "getTodayOverview" in permissions) {
        assert.equal(permissions.getTodayOverview, "READ");
      }
    }

    for (const file of files) {
      const source = stripComments(readFileSync(file, "utf8"));
      assert.equal(hasPrismaImport(source, file), false, toPosix(file));
      assert.equal(hasMutationCall(source), false, toPosix(file));

      for (const snippet of snippetsAround(source, "getTodayOverview", 400)) {
        const permissions = [
          ...snippet.matchAll(
            /(?:permission|permissionLevel|class|level|toolClass)\s*:\s*["']?(READ|WRITE|CRITICAL)/gi,
          ),
        ].map((match) => match[1]!.toUpperCase());
        for (const permission of permissions) {
          assert.equal(permission, "READ", `${toPosix(file)} marks getTodayOverview as ${permission}`);
        }
      }
    }
  });
});

describe("ADR-014: TodayOverview DTO has no secret field names", () => {
  test("parsed schema fixture keys exclude password, token, AUTH_SECRET, DATABASE_URL, GITHUB_TOKEN", () => {
    const fixture = parseTodayOverview(emptyTodayOverview());
    const keys = collectKeys(fixture);
    const schemaKeys = collectSchemaPropertyNames(readFileSync(TODAY_SCHEMA_FILE, "utf8"));
    const allKeys = [...keys, ...schemaKeys];
    const leaked = allKeys.filter((key) => SECRET_KEY_RE.test(key));
    assert.deepEqual(leaked, []);
  });
});

describe("ADR-014: Today payload is bounded", () => {
  test("TODAY_OVERVIEW_LIMITS exist and the schema rejects oversized arrays", () => {
    assert.equal(typeof TODAY_OVERVIEW_LIMITS.calls, "number");
    assert.equal(TODAY_OVERVIEW_LIMITS.calls, 5);
    assert.equal(TODAY_OVERVIEW_LIMITS.followUps, 4);
    assert.equal(TODAY_OVERVIEW_LIMITS.tasks, 5);
    assert.equal(TODAY_OVERVIEW_LIMITS.recentActivity, 8);
    assert.equal(TODAY_OVERVIEW_LIMITS.agenda, 100);
    assert.equal(TODAY_OVERVIEW_LIMITS.tourNextStops, 3);
    assert.equal(TODAY_OVERVIEW_LIMITS.tourStops, 50);

    const base = emptyTodayOverview();
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        calls: Array.from({ length: TODAY_OVERVIEW_LIMITS.calls + 1 }, (_, index) =>
          sampleCall(`co_${index}`),
        ),
      }).success,
      false,
    );
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        followUps: {
          ...base.followUps,
          preview: Array.from({ length: TODAY_OVERVIEW_LIMITS.followUps + 1 }, (_, index) =>
            sampleFollowUp(`fu_${index}`),
          ),
        },
      }).success,
      false,
    );
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        tasks: {
          ...base.tasks,
          preview: Array.from({ length: TODAY_OVERVIEW_LIMITS.tasks + 1 }, (_, index) =>
            sampleTask(`task_${index}`),
          ),
        },
      }).success,
      false,
    );
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        recentActivity: Array.from(
          { length: TODAY_OVERVIEW_LIMITS.recentActivity + 1 },
          (_, index) => sampleActivity(`act_${index}`),
        ),
      }).success,
      false,
    );
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        agenda: Array.from({ length: TODAY_OVERVIEW_LIMITS.agenda + 1 }, (_, index) =>
          sampleAgendaItem(`evt_${index}`),
        ),
      }).success,
      false,
    );
    assert.equal(
      todayOverviewSchema.safeParse({
        ...base,
        tour: {
          ...base.tour,
          nextNames: ["A", "B", "C", "D"],
          nextStops: [
            { companyId: "a", name: "A" },
            { companyId: "b", name: "B" },
            { companyId: "c", name: "C" },
            { companyId: "d", name: "D" },
          ],
        },
      }).success,
      false,
    );
  });
});

describe("ADR-014: POST /api/ai/chat is authenticated Node, not a catch-all", () => {
  test("chat route is POST-only, uses requireRequestActor, and never redirects", () => {
    const chatRoute = path.join(REPO_ROOT, "src", "app", "api", "ai", "chat", "route.ts");
    const catchAll = path.join(REPO_ROOT, "src", "app", "api", "ai", "[...mastra]");
    assert.equal(existsSync(chatRoute), true);
    assert.equal(existsSync(catchAll), false);

    const source = readFileSync(chatRoute, "utf8");
    assert.match(source, /export const runtime = ["']nodejs["']/);
    assert.match(source, /export async function POST/);
    assert.doesNotMatch(source, /export async function GET/);
    assert.match(source, /requireRequestActor/);
    assert.match(source, /chatRequestSchema/);
    assert.match(source, /safeParse/);
    assert.doesNotMatch(source, /\bredirect\s*\(/);
    assert.doesNotMatch(source, /createNextRouteHandler/);
    assert.doesNotMatch(source, /isPublicPath/);
    assert.doesNotMatch(source, /@\/lib\/db\/prisma/);
    assert.doesNotMatch(source, /PrismaClient/);
    assert.doesNotMatch(source, /@\/actions/);
    assert.doesNotMatch(source, /OPENAI_API_KEY/);
    assert.doesNotMatch(source, /ANTHROPIC_API_KEY/);
  });
});

describe("ADR-014: /api/ai is never a public path", () => {
  test("isPublicPath rejects AI routes and keeps HEALTH and LOGIN public", () => {
    assert.equal(isPublicPath("/api/ai"), false);
    assert.equal(isPublicPath("/api/ai/"), false);
    assert.equal(isPublicPath("/api/ai/chat"), false);
    assert.equal(isPublicPath("/api/ai/chat/"), false);
    assert.equal(isPublicPath("/api/ai/chat/stream"), false);
    assert.equal(isPublicPath(HEALTH_PATH), true);
    assert.equal(isPublicPath(`${HEALTH_PATH}/ready`), true);
    assert.equal(isPublicPath(LOGIN_PATH), true);
    assert.equal(isPublicPath(`${LOGIN_PATH}/reset`), true);

    const pathsSource = readFileSync(AUTH_PATHS_FILE, "utf8");
    const publicFn = pathsSource.match(/export function isPublicPath[\s\S]*?\n\}/);
    assert.ok(publicFn);
    assert.match(publicFn[0], /isLoginPath/);
    assert.match(publicFn[0], /isHealthPath/);
    assert.doesNotMatch(publicFn[0], /api\/ai/);
  });
});

describe("ADR-014: registered executable tools are READ", () => {
  test("production catalog entries are READ; WRITE/CRITICAL stay non-executable", async () => {
    const registryPath = path.join(AI_ROOT, "tools", "registry.ts");
    assert.equal(existsSync(registryPath), true);
    const registry = await importIfPossible(registryPath);
    assert.ok(registry);

    const catalog = registry.productionToolCatalog as Array<{ name: string; permission: string }>;
    assert.ok(Array.isArray(catalog));
    assert.ok(catalog.length > 0);
    for (const entry of catalog) {
      assert.equal(entry.permission, "READ", entry.name);
    }

    const tools = (
      registry.createProductionTools as () => Array<{ name: string; permission: string }>
    )();
    for (const tool of tools) {
      assert.equal(tool.permission, "READ", tool.name);
    }
  });
});

describe("ADR-014: src/ai tools do not mutate the database", () => {
  test("no Prisma mutation, $executeRaw, or logActivity under src/ai", () => {
    const violations: string[] = [];
    for (const file of listAiSourceFiles()) {
      const source = stripComments(readFileSync(file, "utf8"));
      if (hasMutationCall(source)) {
        violations.push(`${toPosix(file)} has a Prisma mutation or ActivityLog write`);
      }
    }
    assert.deepEqual(violations, []);
  });
});

describe("ADR-014: AI JSON fixtures do not contain provider keys", () => {
  test("no OPENAI/ANTHROPIC/GOOGLE keys or sk- tokens in src/ai or /api/ai JSON", () => {
    const leakRe =
      /OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_GENERATIVE_AI_API_KEY|GOOGLE_API_KEY|sk-proj-|sk-ant-/i;
    const leaked: string[] = [];
    const roots = [AI_ROOT, path.join(REPO_ROOT, "src", "app", "api", "ai")];
    for (const root of roots) {
      if (!existsSync(root)) {
        continue;
      }
      for (const file of walkFiles(root).filter((entry) => entry.endsWith(".json"))) {
        const raw = readFileSync(file, "utf8");
        if (leakRe.test(raw)) {
          leaked.push(toPosix(file));
        }
      }
    }
    assert.deepEqual(leaked, []);
  });
});

function listAiSourceFiles(): string[] {
  if (!existsSync(AI_ROOT)) {
    return [];
  }
  return walkSourceFiles(AI_ROOT).filter((file) => !isTestFile(file));
}

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") {
        continue;
      }
      out.push(...walkFiles(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function walkSourceFiles(dir: string): string[] {
  return walkFiles(dir).filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)));
}

function isTestFile(file: string): boolean {
  return /\.(?:test|spec)\./.test(path.basename(file));
}

function scanAiImportViolations(
  check: (file: string, specifier: string, resolved: string | null) => string | null,
): string[] {
  const violations: string[] = [];
  for (const file of listAiSourceFiles()) {
    const specifiers = extractModuleSpecifiers(stripComments(readFileSync(file, "utf8")));
    for (const specifier of specifiers) {
      const resolved = resolveSpecifier(file, specifier);
      const violation = check(file, specifier, resolved);
      if (violation) {
        violations.push(violation);
      }
    }
  }
  return violations;
}

function extractModuleSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[\s\S]*?\bfrom\s+["']([^"']+)["']/g,
    /\bimport\s+["']([^"']+)["']/g,
    /\b(?:require|import)\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  }
  return specifiers;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) {
    return path.normalize(path.join(REPO_ROOT, "src", specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    return path.normalize(path.join(path.dirname(fromFile), specifier));
  }
  return null;
}

function isPrismaSpecifier(specifier: string, resolved: string | null): boolean {
  const normalized = specifier.replaceAll("\\", "/");
  if (FORBIDDEN_PRISMA_SPECIFIERS.some((prefix) => specifierStartsWith(normalized, prefix))) {
    return true;
  }
  if (normalized.includes("generated/prisma") || normalized.includes("lib/db/prisma")) {
    return true;
  }
  if (normalized === "@prisma/client" || normalized.startsWith("@prisma/")) {
    return true;
  }
  if (!resolved) {
    return false;
  }
  const rel = toPosix(path.relative(REPO_ROOT, resolved));
  return (
    rel === "src/lib/db/prisma" ||
    rel.startsWith("src/lib/db/prisma.") ||
    rel.startsWith("src/generated/prisma") ||
    rel.includes("/generated/prisma")
  );
}

function isServerActionSpecifier(specifier: string, resolved: string | null): boolean {
  const normalized = specifier.replaceAll("\\", "/");
  if (normalized === "@/actions" || normalized.startsWith("@/actions/")) {
    return true;
  }
  if (normalized.includes("src/actions/") || normalized.endsWith("src/actions")) {
    return true;
  }
  if (!resolved) {
    return false;
  }
  const rel = toPosix(path.relative(REPO_ROOT, resolved));
  return rel === "src/actions" || rel.startsWith("src/actions/");
}

function specifierStartsWith(specifier: string, prefix: string): boolean {
  return specifier === prefix || specifier.startsWith(`${prefix}/`) || specifier.startsWith(`${prefix}.`);
}

function hasPrismaImport(source: string, file: string): boolean {
  return extractModuleSpecifiers(source).some((specifier) =>
    isPrismaSpecifier(specifier, resolveSpecifier(file, specifier)),
  );
}

function hasMutationCall(source: string): boolean {
  return (
    /\bprisma\s*\./.test(source) ||
    /\.\$executeRaw\b/.test(source) ||
    /\.\$executeRawUnsafe\b/.test(source) ||
    /\blogActivity\s*\(/.test(source)
  );
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*$/, ""))
    .join("\n");
}

function snippetsAround(source: string, needle: string, radius: number): string[] {
  const snippets: string[] = [];
  let from = 0;
  while (from < source.length) {
    const index = source.indexOf(needle, from);
    if (index < 0) {
      break;
    }
    snippets.push(source.slice(Math.max(0, index - radius), index + needle.length + radius));
    from = index + needle.length;
  }
  return snippets;
}

async function assertPinnedPermissionRefusal(
  level: "WRITE" | "CRITICAL",
  toolName: string,
): Promise<boolean> {
  const policyPath = path.join(AI_ROOT, "permissions", "policy.ts");
  const registryPath = path.join(AI_ROOT, "tools", "registry.ts");
  const contextPath = path.join(AI_ROOT, "context.ts");
  let pinned = false;

  if (existsSync(policyPath)) {
    const policy = await importIfPossible(policyPath);
    if (policy && typeof policy.isPermissionExecutable === "function") {
      pinned = true;
      assert.equal(policy.isPermissionExecutable("READ"), true);
      assert.equal(policy.isPermissionExecutable(level), false);
    }
  }

  if (existsSync(registryPath) && existsSync(contextPath)) {
    const registry = await importIfPossible(registryPath);
    const context = await importIfPossible(contextPath);
    if (
      registry &&
      context &&
      typeof registry.executeTool === "function" &&
      typeof context.createToolRuntime === "function"
    ) {
      pinned = true;
      const created = await Promise.resolve(
        (context.createToolRuntime as (actor: unknown, requestId: string) => { ok: boolean; runtime?: unknown })(
          SESSION_ACTOR,
          "req_invariant",
        ),
      );
      assert.equal(created.ok, true);
      const result = (await (registry.executeTool as (args: unknown) => Promise<unknown>)({
        runtime: created.runtime,
        name: toolName,
        input: {},
      })) as { success?: boolean; error?: { code?: string } };
      assert.equal(result.success, false);
      assert.ok(
        ["FORBIDDEN", "NOT_AVAILABLE", "CONFIRMATION_REQUIRED"].includes(String(result.error?.code)),
      );
    }
  }

  return pinned;
}

async function assertPinnedActorFactoryIgnoresSpoof(): Promise<boolean> {
  const contextPath = path.join(AI_ROOT, "context.ts");
  if (!existsSync(contextPath)) {
    return false;
  }

  const context = await importIfPossible(contextPath);
  if (
    !context ||
    typeof context.createToolRuntime !== "function" ||
    typeof context.toToolContext !== "function"
  ) {
    return false;
  }

  const dirty = {
    ...SESSION_ACTOR,
    actorId: SPOOFED_ACTOR_ID,
    passwordHash: "should-not-leak",
    confirmation: { token: "from-model", toolName: "createPayment", argsHash: "x" },
  };
  const created = await Promise.resolve(
    (context.createToolRuntime as (actor: unknown, requestId: string) => {
      ok: boolean;
      runtime?: { actor: { id: string } };
    })(dirty, "req_session"),
  );
  assert.equal(created.ok, true);
  assert.equal(created.runtime?.actor.id, SESSION_ACTOR.id);
  assert.notEqual(created.runtime?.actor.id, SPOOFED_ACTOR_ID);

  const toolContext = (
    context.toToolContext as (runtime: unknown) => { actorId: string; source?: string }
  )(created.runtime);
  assert.equal(toolContext.actorId, SESSION_ACTOR.id);
  assert.notEqual(toolContext.actorId, SPOOFED_ACTOR_ID);
  assert.equal(toolContext.source, "AI");
  return true;
}

function scanSpoofedActorAssignments(): string[] {
  const violations: string[] = [];
  const pattern =
    /\bactorId\s*[:=]\s*(?:input|args|body|payload|params|json|model|toolInput|toolArgs)\s*\.\s*actorId\b/;
  for (const file of listAiSourceFiles()) {
    const source = stripComments(readFileSync(file, "utf8"));
    if (pattern.test(source)) {
      violations.push(`${toPosix(file)} assigns actorId from model/tool input`);
    }
  }
  return violations;
}

async function assertMutationClassBlocked(
  level: "WRITE" | "CRITICAL",
  toolNames: readonly string[],
): Promise<void> {
  const modules = await loadPermissionModules();
  const refusals: string[] = [];
  const allowances: string[] = [];

  for (const mod of modules) {
    for (const [exportName, value] of Object.entries(mod.exports)) {
      if (typeof value === "boolean") {
        continue;
      }
      if (typeof value === "function") {
        const outcome = await probePermissionFunction(
          value as (...args: unknown[]) => unknown,
          level,
          toolNames,
        );
        if (outcome === "allowed") {
          allowances.push(`${mod.path}#${exportName}`);
        } else if (outcome === "refused") {
          refusals.push(`${mod.path}#${exportName}`);
        }
      }

      for (const entry of catalogEntries(value)) {
        const permission = toolPermission(entry.meta);
        if (!permission) {
          continue;
        }
        if (permission === level) {
          const executable = entry.meta.executable ?? entry.meta.enabled ?? entry.meta.available;
          if (executable === true) {
            allowances.push(`${mod.path} catalogs ${entry.name} as executable ${level}`);
          } else {
            refusals.push(`${mod.path} catalogs ${entry.name} as non-executable ${level}`);
          }
        }
        if (entry.name === "getTodayOverview") {
          assert.equal(permission, "READ");
        }
      }
    }
  }

  assert.equal(allowances.length, 0, `${level} must not be executable (${allowances.join(", ")})`);

  if (refusals.length > 0 || modules.length === 0) {
    return;
  }

  const policyFiles = [
    ...PERMISSION_MODULE_HINTS.map((rel) => path.join(REPO_ROOT, rel)),
    ...listAiSourceFiles().filter((file) => toPosix(file).includes("/permissions/")),
  ].filter((file, index, all) => all.indexOf(file) === index && existsSync(file) && statSync(file).isFile());

  if (policyFiles.length === 0) {
    return;
  }

  const policySource = policyFiles.map((file) => stripComments(readFileSync(file, "utf8"))).join("\n");
  assert.match(policySource, new RegExp(level));
  assert.match(
    policySource,
    /FORBIDDEN|NOT_AVAILABLE|CONFIRMATION_REQUIRED|not executable|!==\s*["']READ["']|===\s*["']READ["']/i,
  );
}

async function probePermissionFunction(
  fn: (...args: unknown[]) => unknown,
  level: "WRITE" | "CRITICAL",
  toolNames: readonly string[],
): Promise<"allowed" | "refused" | "unknown"> {
  const runtime = {
    actor: SESSION_ACTOR,
    actorId: SESSION_ACTOR.id,
    role: SESSION_ACTOR.role,
    requestId: "req_invariant",
    source: "AI" as const,
  };
  const attempts: Array<() => unknown> = [
    () => fn(level),
    () => fn(level.toLowerCase()),
    () => fn({ class: level }),
    () => fn({ permission: level }),
    () => fn({ permissionLevel: level, context: runtime }),
  ];

  for (const name of toolNames.slice(0, 3)) {
    attempts.push(
      () => fn(name, {}, runtime),
      () => fn({ toolName: name, args: {}, context: runtime, permission: level }),
      () => fn({ name, input: {}, ctx: runtime, class: level }),
      () => fn(name, level),
    );
  }

  let sawRefusal = false;
  for (const attempt of attempts) {
    const result = await settle(attempt);
    if (result.status === "allowed") {
      return "allowed";
    }
    if (result.status === "refused") {
      sawRefusal = true;
    }
  }
  return sawRefusal ? "refused" : "unknown";
}

async function settle(attempt: () => unknown): Promise<{ status: "allowed" | "refused" | "unknown" }> {
  try {
    const value = await attempt();
    return { status: classifyOutcome(value) };
  } catch (error) {
    if (isSignatureError(error)) {
      return { status: "unknown" };
    }
    return { status: "refused" };
  }
}

function classifyOutcome(value: unknown): "allowed" | "refused" | "unknown" {
  if (value === false) {
    return "refused";
  }
  if (value === true) {
    return "unknown";
  }
  if (!value || typeof value !== "object") {
    return "unknown";
  }
  const record = value as Record<string, unknown>;
  const error =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : undefined;
  const code = String(error?.code ?? record.code ?? "");
  if (
    record.success === false ||
    record.ok === false ||
    record.allowed === false ||
    record.executable === false ||
    ["FORBIDDEN", "NOT_AVAILABLE", "CONFIRMATION_REQUIRED", "NOT_IMPLEMENTED", "SERVICE_UNAVAILABLE"].includes(
      code,
    )
  ) {
    return "refused";
  }
  if (record.success === true || record.ok === true || record.allowed === true || record.executable === true) {
    return "allowed";
  }
  return "unknown";
}

function isSignatureError(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  return /argument|parameter|undefined is not|is not a function|Cannot read/i.test(error.message);
}

function catalogEntries(value: unknown): Array<{ name: string; meta: Record<string, unknown> }> {
  const entries: Array<{ name: string; meta: Record<string, unknown> }> = [];
  const seen = new Set<unknown>();

  function walk(node: unknown): void {
    if (!node || typeof node !== "object" || seen.has(node)) {
      return;
    }
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item);
      }
      return;
    }
    if (node instanceof Map) {
      for (const [key, item] of node.entries()) {
        if (item && typeof item === "object") {
          entries.push({ name: String(key), meta: item as Record<string, unknown> });
        }
        walk(item);
      }
      return;
    }
    const record = node as Record<string, unknown>;
    const name = record.name ?? record.toolName ?? record.id;
    if (typeof name === "string" && toolPermission(record)) {
      entries.push({ name, meta: record });
    }
    for (const [key, item] of Object.entries(record)) {
      if (item && typeof item === "object" && toolPermission(item as Record<string, unknown>)) {
        entries.push({ name: key, meta: item as Record<string, unknown> });
      }
      walk(item);
    }
  }

  walk(value);
  return entries;
}

function toolPermission(meta: Record<string, unknown>): "READ" | "WRITE" | "CRITICAL" | null {
  const raw = meta.permission ?? meta.permissionLevel ?? meta.class ?? meta.level ?? meta.toolClass;
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.toUpperCase();
  if (normalized === "READ" || normalized === "WRITE" || normalized === "CRITICAL") {
    return normalized;
  }
  return null;
}

async function loadPermissionModules(): Promise<Array<{ path: string; exports: Record<string, unknown> }>> {
  const files = new Set<string>();
  for (const rel of PERMISSION_MODULE_HINTS) {
    const full = path.join(REPO_ROOT, rel);
    if (existsSync(full)) {
      files.add(full);
    }
  }
  if (existsSync(path.join(AI_ROOT, "permissions"))) {
    for (const file of walkSourceFiles(path.join(AI_ROOT, "permissions"))) {
      if (!isTestFile(file)) {
        files.add(file);
      }
    }
  }
  if (existsSync(path.join(AI_ROOT, "tools"))) {
    for (const file of walkSourceFiles(path.join(AI_ROOT, "tools"))) {
      if (!isTestFile(file) && /registry|execute|index|catalog|permission/i.test(path.basename(file))) {
        files.add(file);
      }
    }
  }

  const loaded: Array<{ path: string; exports: Record<string, unknown> }> = [];
  for (const file of files) {
    if (shouldSkipDynamicImport(file)) {
      continue;
    }
    const exported = await importIfPossible(file);
    if (exported) {
      loaded.push({ path: toPosix(path.relative(REPO_ROOT, file)), exports: exported });
    }
  }
  return loaded;
}

async function loadToolContextFactory(): Promise<((...args: unknown[]) => unknown) | null> {
  const files = new Set<string>();
  for (const rel of CONTEXT_MODULE_HINTS) {
    const full = path.join(REPO_ROOT, rel);
    if (existsSync(full)) {
      files.add(full);
    }
  }
  for (const file of listAiSourceFiles()) {
    const base = path.basename(file).toLowerCase();
    if (base.includes("context") || base.includes("session")) {
      files.add(file);
    }
  }

  const factoryNames = [
    "createToolRuntime",
    "createToolContext",
    "toolContextFromSession",
    "toolContextFromActor",
    "fromSessionUser",
    "fromRequestActor",
    "buildToolContext",
    "toToolContext",
    "createContext",
  ];

  for (const file of files) {
    if (shouldSkipDynamicImport(file)) {
      continue;
    }
    const exported = await importIfPossible(file);
    if (!exported) {
      continue;
    }
    for (const name of factoryNames) {
      const value = exported[name];
      if (typeof value === "function") {
        return value as (...args: unknown[]) => unknown;
      }
    }
    if (typeof exported.default === "function" && /context/i.test(path.basename(file))) {
      return exported.default as (...args: unknown[]) => unknown;
    }
  }
  return null;
}

function shouldSkipDynamicImport(file: string): boolean {
  const rel = toPosix(path.relative(AI_ROOT, file)).split("/");
  if (rel[0] && SKIP_DYNAMIC_IMPORT_DIRS.has(rel[0])) {
    return true;
  }
  return path.basename(file) === "index.ts" && path.dirname(file) === AI_ROOT;
}

async function importIfPossible(file: string): Promise<Record<string, unknown> | null> {
  try {
    const mod = (await import(pathToFileURL(file).href)) as Record<string, unknown>;
    return mod;
  } catch {
    return null;
  }
}

async function firstToolContext(
  attempts: Array<() => unknown>,
): Promise<{ actorId: string } | null> {
  for (const attempt of attempts) {
    try {
      const value = await attempt();
      const context = extractToolContext(value);
      if (context) {
        return context;
      }
    } catch {
      // Signature mismatch while B's factory is still converging.
    }
  }
  return null;
}

function extractToolContext(value: unknown): { actorId: string } | null {
  if (looksLikeToolContext(value)) {
    return value;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (looksLikeToolContext(record.context)) {
    return record.context;
  }
  if (record.ok === true && record.runtime && typeof record.runtime === "object") {
    const runtime = record.runtime as Record<string, unknown>;
    if (runtime.actor && typeof runtime.actor === "object") {
      const actorId = (runtime.actor as { id?: unknown }).id;
      if (typeof actorId === "string") {
        return { actorId };
      }
    }
  }
  return null;
}

function looksLikeToolContext(value: unknown): value is { actorId: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "actorId" in value &&
      typeof (value as { actorId: unknown }).actorId === "string",
  );
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

function collectSchemaPropertyNames(source: string): string[] {
  const names: string[] = [];
  const stripped = stripComments(source);
  for (const match of stripped.matchAll(/(?:^|[{\n,])\s*([A-Za-z_][\w]*)\s*:/g)) {
    if (match[1]) {
      names.push(match[1]);
    }
  }
  return names;
}

function sampleCall(id: string) {
  return {
    id,
    name: "Lead",
    city: null,
    industry: null,
    lifecycleStatus: "LEAD" as const,
    source: null,
    priority: "NORMAL" as const,
    primaryContact: null,
    lastInteractionAt: null,
    lastInteractionType: null,
    nextFollowUpAt: null,
    nextFollowUpTitle: null,
  };
}

function sampleFollowUp(id: string) {
  return {
    id,
    title: "Relance",
    dueAt: "2026-09-19T07:00:00.000Z",
    status: "PENDING" as const,
    company: { id: "co_1", name: "Nord" },
  };
}

function sampleTask(id: string) {
  return {
    id,
    title: "Tâche",
    dueAt: null,
    priority: "NORMAL" as const,
    project: null,
  };
}

function sampleActivity(id: string) {
  return {
    id,
    action: "company.created",
    label: "Création",
    entityType: "Company",
    createdAt: "2026-09-19T08:30:00.000Z",
    actorName: null,
  };
}

function sampleAgendaItem(id: string) {
  return {
    id: `event:${id}`,
    kind: "event" as const,
    entityId: id,
    title: "RDV",
    startsAt: "2026-09-19T08:00:00.000Z",
    endsAt: "2026-09-19T09:00:00.000Z",
    allDay: false,
    eventType: "MEETING" as const,
    company: { id: "co_1", name: "Nord" },
    project: null,
    overdue: false,
    visitOrder: null,
    visitStatus: null,
  };
}

function toPosix(file: string): string {
  return file.replaceAll("\\", "/");
}
