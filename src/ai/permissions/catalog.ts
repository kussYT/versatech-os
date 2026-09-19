import "server-only";

import type { PermissionLevel } from "./policy";

/**
 * Fail-closed permission map. A name absent from this catalog is unknown.
 * WRITE / CRITICAL are classified here so executeTool can refuse them even
 * before an executor is wired.
 */
export const TOOL_PERMISSIONS = {
  getTodayOverview: "READ",
  searchCompanies: "READ",
  getCompany: "READ",
  listFollowUps: "READ",
  listTasks: "READ",
  listCalendarItems: "READ",
  getTodayTour: "READ",
  getPipeline: "READ",
  getFinanceSnapshot: "READ",
  getRecentActivity: "READ",
  webSearch: "READ",
  createCompany: "WRITE",
  createFollowUp: "WRITE",
  completeFollowUp: "WRITE",
  createTask: "WRITE",
  updateOpportunityStageWonLost: "CRITICAL",
  updateQuoteStatus: "CRITICAL",
  createPayment: "CRITICAL",
} as const satisfies Record<string, PermissionLevel>;

export type CatalogToolName = keyof typeof TOOL_PERMISSIONS;

/** LLM-invoked WRITE that may emit a confirmation proposal (never mutates). */
export const CONFIRMABLE_WRITE_TOOLS = ["createFollowUp", "completeFollowUp", "createTask"] as const;

export type ConfirmableWriteToolName = (typeof CONFIRMABLE_WRITE_TOOLS)[number];

export function isConfirmableWriteTool(name: string): name is ConfirmableWriteToolName {
  return (CONFIRMABLE_WRITE_TOOLS as readonly string[]).includes(name);
}

export function getToolPermission(name: string): PermissionLevel | undefined {
  if (Object.prototype.hasOwnProperty.call(TOOL_PERMISSIONS, name)) {
    return TOOL_PERMISSIONS[name as CatalogToolName];
  }
  return undefined;
}

export function isCatalogTool(name: string): name is CatalogToolName {
  return getToolPermission(name) !== undefined;
}
