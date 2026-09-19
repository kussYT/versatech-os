import "server-only";

import type { z } from "zod";
import type { ToolRuntime } from "@/ai/context";
import {
  getToolPermission,
  isPermissionExecutable,
  refusalCodeForPermission,
  refusalMessageForPermission,
  type PermissionLevel,
} from "@/ai/permissions";
import { toolFailure, type ToolResult } from "@/ai/result";
import {
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
  type GetCompanyInput,
  type GetFinanceSnapshotInput,
  type GetPipelineInput,
  type GetRecentActivityInput,
  type GetTodayOverviewInput,
  type GetTodayTourInput,
  type ListCalendarItemsInput,
  type ListFollowUpsInput,
  type ListTasksInput,
  type SearchCompaniesInput,
} from "@/ai/schemas";
import { executeGetCompany, type GetCompanyFn } from "./get-company";
import { executeGetFinanceSnapshot, type GetFinanceSnapshotFn } from "./get-finance-snapshot";
import { executeGetPipeline, type GetPipelineFn } from "./get-pipeline";
import { executeGetRecentActivity, type GetRecentActivityFn } from "./get-recent-activity";
import { executeGetTodayOverview, type GetTodayOverviewFn } from "./get-today-overview";
import { executeGetTodayTour, type GetTodayTourFn } from "./get-today-tour";
import { executeListCalendarItems, type ListCalendarItemsFn } from "./list-calendar-items";
import { executeListFollowUps, type ListFollowUpsFn } from "./list-follow-ups";
import { executeListTasks, type ListTasksFn } from "./list-tasks";
import { executeSearchCompanies, type SearchCompaniesFn } from "./search-companies";

export type RegisteredTool = {
  name: string;
  permission: PermissionLevel;
  inputSchema: z.ZodType;
  execute: (runtime: ToolRuntime, input: unknown) => Promise<ToolResult>;
};

export type ToolCatalogEntry = {
  name: string;
  permission: PermissionLevel;
};

export type ExecuteToolArgs = {
  runtime: ToolRuntime;
  name: string;
  input?: unknown;
};

export type ProductionToolDeps = {
  getTodayOverview?: GetTodayOverviewFn;
  searchCompanies?: SearchCompaniesFn;
  getCompany?: GetCompanyFn;
  listFollowUps?: ListFollowUpsFn;
  listTasks?: ListTasksFn;
  listCalendarItems?: ListCalendarItemsFn;
  getTodayTour?: GetTodayTourFn;
  getPipeline?: GetPipelineFn;
  getFinanceSnapshot?: GetFinanceSnapshotFn;
  getRecentActivity?: GetRecentActivityFn;
};

function refuseNonRead(permission: PermissionLevel): ToolResult<never> {
  if (permission === "READ") {
    return toolFailure("FORBIDDEN");
  }
  return toolFailure(
    refusalCodeForPermission(permission),
    refusalMessageForPermission(permission),
  );
}

export function createProductionTools(deps: ProductionToolDeps = {}): RegisteredTool[] {
  return [
    {
      name: "getTodayOverview",
      permission: "READ",
      inputSchema: getTodayOverviewInputSchema,
      execute: (runtime, input) =>
        executeGetTodayOverview(runtime, input as GetTodayOverviewInput, deps.getTodayOverview),
    },
    {
      name: "searchCompanies",
      permission: "READ",
      inputSchema: searchCompaniesInputSchema,
      execute: (runtime, input) =>
        executeSearchCompanies(runtime, input as SearchCompaniesInput, deps.searchCompanies),
    },
    {
      name: "getCompany",
      permission: "READ",
      inputSchema: getCompanyInputSchema,
      execute: (runtime, input) =>
        executeGetCompany(runtime, input as GetCompanyInput, deps.getCompany),
    },
    {
      name: "listFollowUps",
      permission: "READ",
      inputSchema: listFollowUpsInputSchema,
      execute: (runtime, input) =>
        executeListFollowUps(runtime, input as ListFollowUpsInput, deps.listFollowUps),
    },
    {
      name: "listTasks",
      permission: "READ",
      inputSchema: listTasksInputSchema,
      execute: (runtime, input) =>
        executeListTasks(runtime, input as ListTasksInput, deps.listTasks),
    },
    {
      name: "listCalendarItems",
      permission: "READ",
      inputSchema: listCalendarItemsInputSchema,
      execute: (runtime, input) =>
        executeListCalendarItems(runtime, input as ListCalendarItemsInput, deps.listCalendarItems),
    },
    {
      name: "getTodayTour",
      permission: "READ",
      inputSchema: getTodayTourInputSchema,
      execute: (runtime, input) =>
        executeGetTodayTour(runtime, input as GetTodayTourInput, deps.getTodayTour),
    },
    {
      name: "getPipeline",
      permission: "READ",
      inputSchema: getPipelineInputSchema,
      execute: (runtime, input) =>
        executeGetPipeline(runtime, input as GetPipelineInput, deps.getPipeline),
    },
    {
      name: "getFinanceSnapshot",
      permission: "READ",
      inputSchema: getFinanceSnapshotInputSchema,
      execute: (runtime, input) =>
        executeGetFinanceSnapshot(runtime, input as GetFinanceSnapshotInput, deps.getFinanceSnapshot),
    },
    {
      name: "getRecentActivity",
      permission: "READ",
      inputSchema: getRecentActivityInputSchema,
      execute: (runtime, input) =>
        executeGetRecentActivity(runtime, input as GetRecentActivityInput, deps.getRecentActivity),
    },
  ];
}

export function getToolCatalog(tools: readonly RegisteredTool[]): ToolCatalogEntry[] {
  return tools.map(({ name, permission }) => ({ name, permission }));
}

/**
 * Fail-closed dispatcher.
 * 1. Unknown name → FORBIDDEN
 * 2. WRITE / CRITICAL → NOT_AVAILABLE / FORBIDDEN (executor is not called)
 * 3. Zod input (strips actorId / now / confirmation)
 * 4. READ executor
 *
 * Actor for services is `runtime.actor` (SessionUser). Never pass ToolContext
 * into business services. Model-visible metadata is `toToolContext(runtime)`.
 */
export function createExecuteTool(tools: readonly RegisteredTool[]) {
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  return async function executeTool({
    runtime,
    name,
    input,
  }: ExecuteToolArgs): Promise<ToolResult> {
    const tool = byName.get(name);
    const permission = tool?.permission ?? getToolPermission(name);

    if (permission === undefined) {
      return toolFailure("FORBIDDEN", "Outil inconnu.");
    }

    if (!isPermissionExecutable(permission)) {
      return refuseNonRead(permission);
    }

    if (!tool) {
      return toolFailure("NOT_AVAILABLE");
    }

    const parsed = tool.inputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return toolFailure("VALIDATION_FAILED");
    }

    return tool.execute(runtime, parsed.data);
  };
}

const productionTools = createProductionTools();

export const productionToolCatalog = getToolCatalog(productionTools);

export const executeTool = createExecuteTool(productionTools);
