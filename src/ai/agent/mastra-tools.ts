import "server-only";

import { createTool } from "@mastra/core/tools";
import type { RequestContext } from "@mastra/core/request-context";
import type { z } from "zod";

import { stashPendingConfirmation } from "@/ai/chat/pending-confirmation";
import { createToolRuntime } from "@/ai/context";
import { toolFailure, toModelVisibleToolResult, type ToolResult } from "@/ai/result";
import {
  completeFollowUpInputSchema,
  createFollowUpInputSchema,
  createTaskInputSchema,
  getCompanyInputSchema,
  getFinanceSnapshotInputSchema,
  getPipelineInputSchema,
  getRecentActivityInputSchema,
  getTodayOverviewInputSchema,
  getTodayTourInputSchema,
  listCalendarItemsInputSchema,
  listFollowUpsInputSchema,
  listTasksInputSchema,
  searchCompaniesInputSchema,
  webSearchInputSchema,
} from "@/ai/schemas";
import { executeTool, type ExecuteToolArgs } from "@/ai/tools";
import type { SessionUser } from "@/lib/auth/types";

/**
 * RequestContext keys for POST /api/ai/chat.
 * Set from the session — never from the model body or tool JSON.
 */
export const VERSATECH_AI_ACTOR_CONTEXT_KEY = "versatechActor";
export const VERSATECH_AI_REQUEST_ID_CONTEXT_KEY = "versatechRequestId";

export type VersatechExecuteTool = (args: ExecuteToolArgs) => Promise<unknown>;

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.email === "string" &&
    (record.role === "ADMIN" || record.role === "MEMBER")
  );
}

export function attachVersatechAiActor(
  requestContext: RequestContext,
  actor: SessionUser,
  requestId: string,
): void {
  requestContext.setRaw(VERSATECH_AI_ACTOR_CONTEXT_KEY, {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    role: actor.role,
  });
  requestContext.setRaw(VERSATECH_AI_REQUEST_ID_CONTEXT_KEY, requestId);
}

function executeFromRequestContext(
  name: string,
  inputData: unknown,
  requestContext: RequestContext | undefined,
  execute: VersatechExecuteTool,
) {
  const actorRaw = requestContext?.getRaw(VERSATECH_AI_ACTOR_CONTEXT_KEY);
  const requestIdRaw = requestContext?.getRaw(VERSATECH_AI_REQUEST_ID_CONTEXT_KEY);

  if (!isSessionUser(actorRaw)) {
    return toolFailure("AUTH_REQUIRED");
  }

  const created = createToolRuntime(
    actorRaw,
    typeof requestIdRaw === "string" ? requestIdRaw : "",
  );
  if (!created.ok) {
    return toolFailure("AUTH_REQUIRED");
  }

  return execute({
    runtime: created.runtime,
    name,
    input: inputData,
  }).then((result) => {
    const typed = result as ToolResult;
    stashPendingConfirmation(requestContext, typed);
    return toModelVisibleToolResult(typed);
  });
}

function createVersatechMastraTool(options: {
  id: string;
  description: string;
  inputSchema: z.ZodType;
  execute?: VersatechExecuteTool;
}) {
  const execute = options.execute ?? executeTool;
  return createTool({
    id: options.id,
    description: options.description,
    inputSchema: options.inputSchema,
    execute: async (inputData, context) =>
      executeFromRequestContext(options.id, inputData, context?.requestContext, execute),
  });
}

export function createVersatechMastraTools(execute: VersatechExecuteTool = executeTool) {
  return {
    getTodayOverview: createVersatechMastraTool({
      id: "getTodayOverview",
      description:
        "Briefing du jour civil Europe/Paris (agenda, appels, relances, tâches, tournée, KPI). Utiliser pour « Qu'est-ce que j'ai aujourd'hui ? ». Ne jamais inventer de données.",
      inputSchema: getTodayOverviewInputSchema,
      execute,
    }),
    searchCompanies: createVersatechMastraTool({
      id: "searchCompanies",
      description:
        "Recherche d'entreprises par texte (nom, ville, secteur, e-mail), filtres lifecycle et ville. Renvoie des ids CRM, pas des liens.",
      inputSchema: searchCompaniesInputSchema,
      execute,
    }),
    getCompany: createVersatechMastraTool({
      id: "getCompany",
      description:
        "Fiche compacte d'une entreprise par id persisté. Ce n'est pas le hub UI. Ne jamais inventer une fiche.",
      inputSchema: getCompanyInputSchema,
      execute,
    }),
    listFollowUps: createVersatechMastraTool({
      id: "listFollowUps",
      description:
        "Relances du board (en retard, aujourd'hui, à venir, éventuellement terminées), filtrables par entreprise.",
      inputSchema: listFollowUpsInputSchema,
      execute,
    }),
    listTasks: createVersatechMastraTool({
      id: "listTasks",
      description:
        "Tâches ouvertes (à faire / en cours), filtrables par échéance, projet ou entreprise.",
      inputSchema: listTasksInputSchema,
      execute,
    }),
    listCalendarItems: createVersatechMastraTool({
      id: "listCalendarItems",
      description:
        "Planning fusionné sur une plage de jours civils Paris : événements, relances, tâches, deadlines, jalons et visites terrain (TourStop). Les visites ne sont pas des RDV commerciaux.",
      inputSchema: listCalendarItemsInputSchema,
      execute,
    }),
    getTodayTour: createVersatechMastraTool({
      id: "getTodayTour",
      description:
        "Tournée du jour civil Europe/Paris (arrêts TourStop ordonnés). Absent si aucune tournée. Ne crée pas de tournée.",
      inputSchema: getTodayTourInputSchema,
      execute,
    }),
    getPipeline: createVersatechMastraTool({
      id: "getPipeline",
      description:
        "Pipeline commercial : colonnes par stage, totaux brut et pondéré, cartes d'opportunités. Ce n'est pas du CA signé.",
      inputSchema: getPipelineInputSchema,
      execute,
    }),
    getFinanceSnapshot: createVersatechMastraTool({
      id: "getFinanceSnapshot",
      description:
        "Pilotage CA en lecture : signé, encaissé, restant, retards, MRR/ARR déjà calculés. N'écrit aucun paiement.",
      inputSchema: getFinanceSnapshotInputSchema,
      execute,
    }),
    getRecentActivity: createVersatechMastraTool({
      id: "getRecentActivity",
      description:
        "Journal métier récent : actions libellées, sans métadonnées brutes.",
      inputSchema: getRecentActivityInputSchema,
      execute,
    }),
    webSearch: createVersatechMastraTool({
      id: "webSearch",
      description:
        "Recherche web contrôlée pour des faits actuels ou externes (extraits sourcés). Ce n'est pas le CRM. Si l'outil est indisponible, le dire ; ne pas inventer.",
      inputSchema: webSearchInputSchema,
      execute,
    }),
    createFollowUp: createVersatechMastraTool({
      id: "createFollowUp",
      description:
        "Préparer une relance (companyId persisté, dueAt ISO 8601). Convertir demain/lundi en jour civil Europe/Paris avant l'appel. Ne mute pas : renvoie une proposition à confirmer.",
      inputSchema: createFollowUpInputSchema,
      execute,
    }),
    completeFollowUp: createVersatechMastraTool({
      id: "completeFollowUp",
      description:
        "Préparer la clôture d'une relance PENDING par followUpId persisté. Ne mute pas : proposition à confirmer.",
      inputSchema: completeFollowUpInputSchema,
      execute,
    }),
    createTask: createVersatechMastraTool({
      id: "createTask",
      description:
        "Préparer une tâche (title, companyId ou projectId persisté, dueAt ISO optionnel). Convertir les dates relatives en Europe/Paris. Ne mute pas : proposition à confirmer.",
      inputSchema: createTaskInputSchema,
      execute,
    }),
  };
}

/**
 * Mastra adapters around Agent B's fail-closed `executeTool`.
 * Actor comes from RequestContext (session), never from tool JSON.
 */
export const versatechMastraTools = createVersatechMastraTools();
