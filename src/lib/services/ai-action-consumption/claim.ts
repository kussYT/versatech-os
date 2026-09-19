import "server-only";

import { AlreadyConsumedError } from "./errors";
import { isUniqueConstraintViolation } from "./unique-violation";

export type ClaimAiActionConsumptionInput = {
  actionId: string;
  actorId: string;
  toolName: string;
  expiresAt: Date;
};

/**
 * Minimal transaction surface. Callers must pass an open Prisma transaction
 * client — this function never `$transaction`s or commits on its own.
 */
export type AiActionConsumptionClaimTx = {
  aiActionConsumption: {
    create: (args: {
      data: {
        actionId: string;
        actorId: string;
        toolName: string;
        consumedAt: Date;
        expiresAt: Date;
      };
    }) => Promise<unknown>;
  };
};

/**
 * INSERT-only claim. Unique `actionId` is the anti-replay authority.
 * Never SELECT-then-INSERT.
 */
export async function claimAiActionConsumption(
  tx: AiActionConsumptionClaimTx,
  input: ClaimAiActionConsumptionInput,
): Promise<void> {
  try {
    await tx.aiActionConsumption.create({
      data: {
        actionId: input.actionId,
        actorId: input.actorId,
        toolName: input.toolName,
        consumedAt: new Date(),
        expiresAt: input.expiresAt,
      },
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new AlreadyConsumedError(input.actionId);
    }
    throw error;
  }
}
