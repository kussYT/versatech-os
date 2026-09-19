import "server-only";

/**
 * First-scenario router (tests + documentation).
 * The Mastra agent is instructed to take the same path; this function is
 * deterministic and does not call an LLM.
 *
 * Canonical question → the only mutation-free tool is `getTodayOverview`.
 */
export const TODAY_BRIEFING_QUESTION = "Qu'est-ce que j'ai aujourd'hui ?";

export const TODAY_BRIEFING_TOOL = "getTodayOverview" as const;

function normalizeOperatorMessage(message: string): string {
  return message.normalize("NFC").trim().toLowerCase().replaceAll("’", "'");
}

export function resolveTodayBriefingTool(message: string): typeof TODAY_BRIEFING_TOOL | null {
  if (normalizeOperatorMessage(message) === normalizeOperatorMessage(TODAY_BRIEFING_QUESTION)) {
    return TODAY_BRIEFING_TOOL;
  }
  return null;
}
