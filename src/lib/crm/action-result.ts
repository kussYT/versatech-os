export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: FieldErrors;
  data?: {
    companyId?: string;
    name?: string;
    interactionId?: string;
    followUpId?: string;
    opportunityId?: string;
    quoteId?: string;
    projectId?: string;
    taskId?: string;
    milestoneId?: string;
  };
};

export const idleActionResult: ActionResult = { ok: false };
