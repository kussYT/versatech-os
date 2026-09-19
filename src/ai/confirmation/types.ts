import "server-only";

import { z } from "zod";
import {
  CONFIRMABLE_WRITE_TOOLS,
  type ConfirmableWriteToolName,
} from "@/ai/permissions/catalog";

export { CONFIRMABLE_WRITE_TOOLS, type ConfirmableWriteToolName };

/**
 * Server proposal after `createWriteProposal`.
 * `confirmToken` / `token` is the opaque jose signature. `actorId` is for the
 * confirm path / Agent C — strip it before any model-visible tool result.
 */
export type WriteProposal = {
  toolName: ConfirmableWriteToolName;
  args: Record<string, unknown>;
  humanSummary: string;
  actorId: string;
  requestId: string;
  issuedAt: string;
  expiresAt: string;
  actionId: string;
  confirmToken: string;
  token: string;
};

export type CreateRegistryWriteProposalInput = {
  actorId: string;
  requestId: string;
  toolName: ConfirmableWriteToolName;
  args: Record<string, unknown>;
  humanSummary: string;
};

/** @deprecated Use CreateRegistryWriteProposalInput. Kept for Agent C imports. */
export type CreateWriteProposalInput = CreateRegistryWriteProposalInput;

export const writeProposalSchema = z.object({
  toolName: z.enum(CONFIRMABLE_WRITE_TOOLS),
  args: z.record(z.string(), z.unknown()),
  humanSummary: z.string(),
  actorId: z.string().min(1),
  requestId: z.string().min(1).optional(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  actionId: z.string().min(1).optional(),
  confirmToken: z.string().optional(),
  token: z.string().optional(),
});
