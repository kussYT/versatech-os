import "server-only";

import type { SessionUser } from "@/lib/auth/types";
import type { PipelineDto } from "@/lib/services/opportunities/schema";
import type { ToolRuntime } from "@/ai/context";
import { toolFailure, toolSuccess, type ToolResult } from "@/ai/result";
import type { GetPipelineInput } from "@/ai/schemas/get-pipeline";

export type GetPipelineFn = (input: {
  actor: SessionUser;
  openOnly?: boolean;
  limitPerStage?: number;
}) => Promise<PipelineDto>;

async function defaultGetPipeline(input: {
  actor: SessionUser;
  openOnly?: boolean;
  limitPerStage?: number;
}): Promise<PipelineDto> {
  const { OpportunityService } = await import("@/lib/services/opportunities");
  return OpportunityService.getPipeline({
    actor: input.actor,
    openOnly: input.openOnly,
    limitPerStage: input.limitPerStage,
  });
}

/**
 * READ tool: `OpportunityService.getPipeline`.
 * Money strings via money.ts / effectiveProbability — pas du CA signé.
 */
export async function executeGetPipeline(
  runtime: ToolRuntime,
  input: GetPipelineInput,
  getPipeline: GetPipelineFn = defaultGetPipeline,
): Promise<ToolResult<PipelineDto>> {
  try {
    const data = await getPipeline({
      actor: runtime.actor,
      openOnly: input.openOnly,
      limitPerStage: input.limitPerStage,
    });
    return toolSuccess(data);
  } catch {
    return toolFailure("INTERNAL");
  }
}
