import { formatDate, formatDateTime } from "@/lib/dates";

export const CONFIRM_ENDPOINT = "/api/ai/actions/confirm";

/** One WRITE proposal at a time — no automatic chain from « Crée 10 relances ». */
export const WRITE_CONFIRMATION_MAX_PER_TURN = 1;

export const CONFIRMATION_TITLE = "Action proposée";
export const CONFIRMATION_PROMPT_MESSAGE = "Une action nécessite votre confirmation.";
export const CONFIRMATION_EXPIRED_MESSAGE =
  "Cette proposition a expiré. Reformulez votre demande.";
export const CONFIRMATION_FORBIDDEN_MESSAGE = "Cette action n'est pas autorisée.";
export const CONFIRMATION_SUCCESS_FALLBACK = "Action confirmée.";
export const CONFIRMATION_GENERIC_ERROR = "Une erreur interne est survenue.";
export const CONFIRMATION_SESSION_ERROR = "Session expirée. Reconnectez-vous.";
export const CONFIRMATION_ALREADY_MESSAGE = "Cette action a déjà été confirmée.";
export const CONFIRMATION_DATE_MISSING = "non précisée";

const SECRETISH =
  /(api[_-]?key|sk-[a-zA-Z0-9]|AUTH_SECRET|DATABASE_URL|GITHUB_TOKEN|OPENAI_API_KEY|password=|Bearer\s+[A-Za-z0-9._-]+)/i;

/**
 * Operator-facing labels. Internal tool names must never be the only label.
 * Keep in sync with the permission catalog names; this map is display-only.
 */
export const WRITE_TOOL_LABELS: Record<string, string> = {
  createCompany: "Créer une entreprise",
  createFollowUp: "Créer une relance",
  completeFollowUp: "Terminer une relance",
  rescheduleFollowUp: "Replanifier une relance",
  recordInteraction: "Enregistrer une interaction",
  recordTerrainVisit: "Enregistrer une visite terrain",
  createTask: "Créer une tâche",
  updateTaskStatus: "Mettre à jour une tâche",
  createCalendarEvent: "Créer un événement",
  updateCalendarEvent: "Modifier un événement",
  createOpportunity: "Créer une opportunité",
  updateOpportunityStage: "Mettre à jour le stage",
  ensureTodayTour: "Préparer la tournée du jour",
  addCompanyToTodayTour: "Ajouter à la tournée",
  moveTourStop: "Déplacer un arrêt",
};

const CRITICAL_TOOL_LABELS: Record<string, string> = {
  updateOpportunityStageWonLost: "Passer une opportunité en gagné ou perdu",
  createQuote: "Créer un devis",
  updateQuoteStatus: "Mettre à jour un devis",
  createPayment: "Créer un paiement",
  updatePaymentStatus: "Mettre à jour un paiement",
  createProject: "Créer un projet",
  updateProjectStatus: "Mettre à jour un projet",
  createMaintenanceContract: "Créer un contrat de maintenance",
  updateMaintenanceContract: "Mettre à jour un contrat de maintenance",
  updateMaintenanceStatus: "Mettre à jour la maintenance",
  associateGitHubRepository: "Associer un dépôt GitHub",
  unlinkGitHubRepository: "Délier un dépôt GitHub",
  removeCompanyFromTodayTour: "Retirer de la tournée du jour",
};

const CRITICAL_TOOL_NAMES = new Set(Object.keys(CRITICAL_TOOL_LABELS));

export type ConfirmationBlockedReason = "FORBIDDEN" | "EXPIRED";

export type ConfirmationView = {
  token: string;
  actionId?: string;
  toolName?: string;
  label: string;
  humanSummary: string[];
  dateIso: string | null;
  dateLabel: string;
  companyName?: string;
  expiresAt?: string;
  executable: boolean;
  blockedReason?: ConfirmationBlockedReason;
};

export type ConfirmationRequestResult =
  | { ok: true; message: string }
  | {
      ok: false;
      reason: "expired" | "error" | "session" | "forbidden" | "consumed";
      message: string;
    };

export type ConfirmRequestInput = {
  token: string;
  actionId?: string;
  toolName?: unknown;
  args?: unknown;
  actorId?: unknown;
  confirmed?: unknown;
};

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toolLabel(toolName: string | undefined): string {
  if (!toolName) {
    return "Action métier";
  }
  return WRITE_TOOL_LABELS[toolName] ?? CRITICAL_TOOL_LABELS[toolName] ?? "Action métier";
}

export function isCriticalToolName(toolName: string | undefined): boolean {
  return Boolean(toolName && CRITICAL_TOOL_NAMES.has(toolName));
}

export function uniqueCompanyIdFromHits(hits: ReadonlyArray<{ id: string }>): string | null {
  const ids = [...new Set(hits.map((hit) => hit.id).filter((id) => id.length > 0))];
  return ids.length === 1 ? ids[0]! : null;
}

/** 0 or N>1 persisted companies → no WRITE proposal (do not invent an id). */
export function shouldProposeWriteForCompanySearch(
  hits: ReadonlyArray<{ id: string }>,
): boolean {
  return uniqueCompanyIdFromHits(hits) !== null;
}

export function canOpenWriteProposal(existingOpenCount: number): boolean {
  return existingOpenCount < WRITE_CONFIRMATION_MAX_PER_TURN;
}

export function formatProposalDate(value: string | undefined | null): {
  iso: string | null;
  label: string;
} {
  if (!value || typeof value !== "string" || !value.trim()) {
    return { iso: null, label: CONFIRMATION_DATE_MISSING };
  }
  const trimmed = value.trim();
  if (CIVIL_DATE.test(trimmed)) {
    try {
      return { iso: trimmed, label: formatDate(trimmed) };
    } catch {
      return { iso: trimmed, label: trimmed };
    }
  }
  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return { iso: null, label: CONFIRMATION_DATE_MISSING };
  }
  try {
    return { iso: new Date(ms).toISOString(), label: formatDateTime(trimmed) };
  } catch {
    return { iso: trimmed, label: CONFIRMATION_DATE_MISSING };
  }
}

export function isProposalExpired(proposal: ConfirmationView, now = Date.now()): boolean {
  if (proposal.blockedReason === "EXPIRED") {
    return true;
  }
  if (!proposal.expiresAt) {
    return false;
  }
  const expires = Date.parse(proposal.expiresAt);
  return !Number.isNaN(expires) && expires <= now;
}

export function isProposalExecutable(proposal: ConfirmationView, now = Date.now()): boolean {
  return proposal.executable && !isProposalExpired(proposal, now);
}

/**
 * LLM `confirmed: true` is ignored. A proposal exists only with an opaque
 * server token on a confirmation/proposal envelope — never toolName+args alone.
 */
export function parseConfirmationPayload(payload: unknown): ConfirmationView | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  if (!looksLikeConfirmationEnvelope(record)) {
    return null;
  }

  const nested = firstRecord(
    record.proposal,
    record.confirmation,
    record.confirmation_required,
    record.confirmationRequired,
    record.view,
  );
  const source: Record<string, unknown> = nested ? { ...nested, ...pickViewFields(record) } : record;
  if (nested) {
    for (const [key, value] of Object.entries(pickViewFields(nested))) {
      if (source[key] === undefined) {
        source[key] = value;
      }
    }
  }

  const token = readToken(source) ?? readToken(record) ?? readToken(nested);
  if (!token) {
    return null;
  }

  const toolName = readToolName(source) ?? readToolName(record);
  const args = asRecord(source.args) ?? asRecord(record.args);
  const summaryRaw = source.humanSummary ?? record.humanSummary;
  const dateRaw =
    readString(source.dueAt) ??
    readString(source.date) ??
    readString(source.scheduledAt) ??
    readString(source.startsAt) ??
    readString(source.occursAt) ??
    readString(args?.dueAt) ??
    readString(args?.date) ??
    extractDateFromSummary(summaryRaw);
  const date = formatProposalDate(dateRaw);
  const companyName =
    readString(source.companyName) ??
    readString(asRecord(source.company)?.name) ??
    readString(args?.companyName) ??
    undefined;
  const expiresAt =
    readString(source.expiresAt) ?? readString(source.expiry) ?? readString(record.expiresAt);
  const actionId = readString(source.actionId) ?? readString(record.actionId);
  const label = toolLabel(toolName);
  const humanSummary = buildHumanSummary(source.humanSummary ?? record.humanSummary, {
    toolName,
    label,
    companyName,
  });

  const critical = isCriticalToolName(toolName);
  const expired = Boolean(expiresAt && !Number.isNaN(Date.parse(expiresAt)) && Date.parse(expiresAt) <= Date.now());
  const executable = !critical && !expired;

  const view: ConfirmationView = {
    token,
    label,
    humanSummary,
    dateIso: date.iso,
    dateLabel: date.label,
    executable,
  };
  if (actionId) {
    view.actionId = actionId;
  }
  if (toolName) {
    view.toolName = toolName;
  }
  if (companyName) {
    view.companyName = companyName;
  }
  if (expiresAt) {
    view.expiresAt = expiresAt;
  }
  if (critical) {
    view.blockedReason = "FORBIDDEN";
  } else if (expired) {
    view.blockedReason = "EXPIRED";
  }
  return view;
}

export function parseConfirmationFromChatResponse(payload: unknown): ConfirmationView | null {
  return parseConfirmationPayload(payload);
}

/** POST body: opaque `{ token }` only. Never args/actor/tool/actionId. */
export function buildConfirmRequestBody(input: ConfirmRequestInput): string {
  const body = { token: input.token.trim() };
  return JSON.stringify(body);
}

export function confirmRequestBodyKeys(input: ConfirmRequestInput): string[] {
  return Object.keys(JSON.parse(buildConfirmRequestBody(input)) as Record<string, unknown>).sort();
}

/** Local dismiss only — never POST /api/ai/actions/confirm. */
export function cancelProposedAction(): void {}

export async function confirmProposedAction(
  input: ConfirmRequestInput,
  fetchFn: typeof fetch = fetch,
): Promise<ConfirmationRequestResult> {
  const response = await fetchFn(CONFIRM_ENDPOINT, {
    method: "POST",
    credentials: "include",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: buildConfirmRequestBody(input),
  });
  return confirmationResultFromResponse(response);
}

export async function confirmationResultFromResponse(
  response: Response,
): Promise<ConfirmationRequestResult> {
  if (response.status === 401 || isConfirmSessionRedirect(response)) {
    return { ok: false, reason: "session", message: CONFIRMATION_SESSION_ERROR };
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const code = readErrorCode(payload);
  const rawMessage = readResultMessage(payload);

  if (isExpiredStatus(response.status, code)) {
    return { ok: false, reason: "expired", message: CONFIRMATION_EXPIRED_MESSAGE };
  }
  if (isConsumedStatus(response.status, code)) {
    return { ok: false, reason: "consumed", message: CONFIRMATION_ALREADY_MESSAGE };
  }
  if (response.status === 403 || code === "FORBIDDEN") {
    return { ok: false, reason: "forbidden", message: CONFIRMATION_FORBIDDEN_MESSAGE };
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: "error",
      message: sanitizeConfirmMessage(rawMessage) ?? CONFIRMATION_GENERIC_ERROR,
    };
  }

  return {
    ok: true,
    message: successMessageFromPayload(payload) ?? CONFIRMATION_SUCCESS_FALLBACK,
  };
}

export function createDoubleSubmitGuard() {
  let locked = false;
  return {
    isLocked() {
      return locked;
    },
    async run<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (locked) {
        return undefined;
      }
      locked = true;
      try {
        return await fn();
      } finally {
        locked = false;
      }
    },
  };
}

function looksLikeConfirmationEnvelope(record: Record<string, unknown>): boolean {
  const type = String(record.type ?? record.event ?? "");
  if (
    type === "confirmation_required" ||
    type === "proposal" ||
    type === "confirmation"
  ) {
    return true;
  }
  return Boolean(
    asRecord(record.proposal) ||
      asRecord(record.confirmation) ||
      asRecord(record.confirmation_required) ||
      asRecord(record.confirmationRequired) ||
      asRecord(record.view),
  );
}

function pickViewFields(record: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "token",
    "actionId",
    "toolName",
    "name",
    "humanSummary",
    "dueAt",
    "date",
    "scheduledAt",
    "startsAt",
    "occursAt",
    "companyName",
    "company",
    "expiresAt",
    "expiry",
    "args",
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (record[key] !== undefined) {
      out[key] = record[key];
    }
  }
  return out;
}

function readToken(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const direct = readString(value.token) ?? readString(value.confirmToken);
  if (direct) {
    return direct;
  }
  const confirmation = asRecord(value.confirmation);
  if (confirmation) {
    const nested = readString(confirmation.token) ?? readString(confirmation.confirmToken);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function readToolName(value: Record<string, unknown> | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return readString(value.toolName) ?? readString(value.name) ?? undefined;
}

function buildHumanSummary(
  raw: unknown,
  extras: { toolName?: string; label: string; companyName?: string },
): string[] {
  const lines: string[] = [];
  if (typeof raw === "string" && raw.trim()) {
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = remapSummaryLine(line.trim(), extras.toolName);
      if (trimmed) {
        lines.push(trimmed);
      }
    }
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "string") {
        continue;
      }
      const trimmed = remapSummaryLine(item.trim(), extras.toolName);
      if (trimmed) {
        lines.push(trimmed);
      }
    }
  }

  const withoutInternal = lines.filter((line) => line !== extras.toolName);
  if (!withoutInternal.includes(extras.label)) {
    withoutInternal.unshift(extras.label);
  }
  if (extras.companyName) {
    const companyLine = `Entreprise : ${extras.companyName}`;
    if (!withoutInternal.some((line) => line.includes(extras.companyName!))) {
      withoutInternal.push(companyLine);
    }
  }

  if (withoutInternal.length === 1 && extras.toolName && withoutInternal[0] === extras.toolName) {
    return [extras.label];
  }
  return withoutInternal;
}

function remapSummaryLine(line: string, toolName: string | undefined): string {
  if (!line) {
    return "";
  }
  if (WRITE_TOOL_LABELS[line]) {
    return WRITE_TOOL_LABELS[line]!;
  }
  if (CRITICAL_TOOL_LABELS[line]) {
    return CRITICAL_TOOL_LABELS[line]!;
  }
  if (toolName && line === toolName) {
    return toolLabel(toolName);
  }
  return line;
}

function extractDateFromSummary(raw: unknown): string | null {
  const text = Array.isArray(raw)
    ? raw.filter((item) => typeof item === "string").join(" ")
    : typeof raw === "string"
      ? raw
      : "";
  if (!text) {
    return null;
  }
  const civil = text.match(/(?:jour\s+)?civil\s+(\d{4}-\d{2}-\d{2})/i);
  if (civil?.[1]) {
    return civil[1];
  }
  const iso = text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z/);
  if (iso?.[0]) {
    return iso[0];
  }
  const day = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return day?.[1] ?? null;
}

const WRITE_SUCCESS_MESSAGES: Record<string, string> = {
  createFollowUp: "Relance créée.",
  completeFollowUp: "Relance terminée.",
  createTask: "Tâche créée.",
};

function successMessageFromPayload(payload: unknown): string | null {
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const toolName = readString(record.toolName);
  if (toolName && WRITE_SUCCESS_MESSAGES[toolName]) {
    return WRITE_SUCCESS_MESSAGES[toolName]!;
  }
  const explicit = sanitizeConfirmMessage(readResultMessage(payload));
  if (explicit && !/createFollowUp|completeFollowUp|createTask/.test(explicit)) {
    return explicit;
  }
  const data = asRecord(record.data);
  if (data && typeof data.taskId === "string") {
    return WRITE_SUCCESS_MESSAGES.createTask!;
  }
  if (data && typeof data.followUpId === "string") {
    return WRITE_SUCCESS_MESSAGES.createFollowUp!;
  }
  if (record.ok === true) {
    return CONFIRMATION_SUCCESS_FALLBACK;
  }
  return explicit;
}

function readResultMessage(payload: unknown): string | null {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  const record = asRecord(payload);
  if (!record) {
    return null;
  }
  const error = asRecord(record.error);
  return (
    readString(record.message) ??
    readString(record.text) ??
    (typeof record.error === "string" ? record.error.trim() : null) ??
    readString(error?.message) ??
    readString(asRecord(record.result)?.message) ??
    readString(asRecord(record.data)?.message)
  );
}

function readErrorCode(payload: unknown): string {
  const record = asRecord(payload);
  if (!record) {
    return "";
  }
  const error = asRecord(record.error);
  return String(error?.code ?? record.code ?? "").toUpperCase();
}

function isExpiredStatus(status: number, code: string) {
  return (
    status === 410 ||
    code === "EXPIRED" ||
    code === "CONFIRMATION_EXPIRED" ||
    code === "TOKEN_EXPIRED"
  );
}

function isConsumedStatus(status: number, code: string) {
  return (
    status === 409 ||
    code === "ALREADY_CONSUMED" ||
    code === "TOKEN_CONSUMED" ||
    code === "CONSUMED"
  );
}

function isConfirmSessionRedirect(response: Response) {
  if (response.status < 300 || response.status >= 400) {
    return false;
  }
  const location = response.headers.get("location") ?? "";
  return /connexion/i.test(location) || location.length > 0;
}

function sanitizeConfirmMessage(message: string | null): string | null {
  if (!message) {
    return null;
  }
  const trimmed = message.trim();
  if (!trimmed || SECRETISH.test(trimmed) || trimmed.length > 280) {
    return null;
  }
  return trimmed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstRecord(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    const record = asRecord(value);
    if (record) {
      return record;
    }
  }
  return null;
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}
