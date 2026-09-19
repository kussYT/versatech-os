import "server-only";

import { Mastra } from "@mastra/core";

import { VERSATECH_AGENT_ID, versatechAgent } from "@/ai/agent/versatech-agent";

/**
 * In-process Mastra orchestrator (ADR-014).
 *
 * POST /api/ai/chat:
 * - Node runtime (`export const runtime = "nodejs"`)
 * - requireRequestActor (401 JSON, no redirect)
 * - never add `/api/ai` to `isPublicPath()`
 * - do not mount `@mastra/next` `createNextRouteHandler`
 *
 * No LibSQL, no Memory, no voice, no web adapter, no catch-all API.
 */
const globalForMastra = globalThis as unknown as {
  versatechMastra: Mastra | undefined;
};

function createMastra() {
  return new Mastra({
    agents: { versatechAgent },
    workers: false,
    logger: false,
    notifications: { dispatch: { enabled: false } },
  });
}

export const mastra = globalForMastra.versatechMastra ?? createMastra();

if (process.env.NODE_ENV !== "production") {
  globalForMastra.versatechMastra = mastra;
}

export { VERSATECH_AGENT_ID, versatechAgent };
export {
  attachVersatechAiActor,
  VERSATECH_AI_ACTOR_CONTEXT_KEY,
  VERSATECH_AI_REQUEST_ID_CONTEXT_KEY,
} from "@/ai/agent/mastra-tools";
export { getLanguageModel, isVersatechAiConfigured } from "@/ai/providers/model";
