import "server-only";

import { z } from "zod";
import { PRIORITIES } from "@/lib/services/tasks/schema";
import { UNTRUSTED_TEXT_MAX_CHARS, isoDateTimeStringSchema } from "./common";

/**
 * WRITE input. Unknown keys (`actorId`, `now`, `confirmation`) are stripped.
 * Company-scoped create is allowed (no required projectId). At least one of
 * `companyId` / `projectId` must be a persisted id.
 */
export const createTaskInputSchema = z
  .object({
    title: z.string().trim().min(1).max(UNTRUSTED_TEXT_MAX_CHARS),
    dueAt: isoDateTimeStringSchema.optional(),
    priority: z.enum(PRIORITIES).default("NORMAL"),
    projectId: z.string().min(1).optional(),
    companyId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.companyId && !value.projectId) {
      ctx.addIssue({
        code: "custom",
        message: "companyId ou projectId requis.",
        path: ["companyId"],
      });
    }
  });

export const createTaskOutputSchema = z.object({
  taskId: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>;
export type CreateTaskOutput = z.infer<typeof createTaskOutputSchema>;
