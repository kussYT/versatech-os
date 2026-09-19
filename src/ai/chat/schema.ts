import "server-only";

import { z } from "zod";

export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_HISTORY_MAX_MESSAGES = 20;
export const CHAT_HISTORY_MAX_CHARS = 24_000;
export const CHAT_HISTORY_ROLES = ["user", "assistant"] as const;

export type ChatHistoryRole = (typeof CHAT_HISTORY_ROLES)[number];

export type ChatTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

/**
 * Client history: conversation turns only. `system` / `tool` are VALIDATION
 * errors. `actorId`, `source`, and `confirmation` on the body are stripped.
 */
export const chatHistoryItemSchema = z.object({
  role: z.enum(CHAT_HISTORY_ROLES),
  content: z.string().trim().min(1),
});

export const chatHistorySchema = z
  .array(chatHistoryItemSchema)
  .max(CHAT_HISTORY_MAX_MESSAGES)
  .superRefine((items, ctx) => {
    const historyChars = items.reduce((total, item) => total + item.content.length, 0);
    if (historyChars > CHAT_HISTORY_MAX_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: "history too large",
      });
    }
  });

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  history: chatHistorySchema.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Request-scoped conversation for Mastra `stream` / `generate`.
 * Assistant turns stay messages — never merged into system instructions.
 */
export function toAgentMessages(request: ChatRequest): ChatTurn[] {
  const history: ChatTurn[] = (request.history ?? []).map((item) =>
    item.role === "assistant"
      ? { role: "assistant", content: item.content }
      : { role: "user", content: item.content },
  );
  return [...history, { role: "user", content: request.message }];
}
