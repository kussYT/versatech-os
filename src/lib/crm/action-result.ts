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
    confirmationToken?: string;
    quoteId?: string;
    companyName?: string;
    proposeFollowUp?: boolean;
    offerProject?: boolean;
    projectId?: string;
    taskId?: string;
    milestoneId?: string;
    repositoryId?: string;
    documentId?: string;
    calendarEventId?: string;
    paymentId?: string;
    maintenanceContractId?: string;
    tourId?: string;
    savedValue?: string | null;
  };
};

export const idleActionResult: ActionResult = { ok: false };
