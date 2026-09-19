import {
  parseConfirmationPayload,
  type ConfirmationView,
} from "@/components/ai/confirmation";
import {
  extractHttpsSourcesFromMarkdown,
  isWebSearchErrorText,
  mergeChatSources,
  parseSourcesPayload,
  parseStatusPayload,
  WEB_SEARCH_UNAVAILABLE_MESSAGE,
  type ChatSourceLink,
} from "@/components/ai/sources";

export const CHAT_ENDPOINT = "/api/ai/chat";
export const CHAT_MESSAGE_MAX_LENGTH = 4000;
export const CHAT_HISTORY_TURN_CAP = 20;
export const CHAT_HISTORY_MAX_MESSAGES = 20;
export const CHAT_HISTORY_MAX_CHARS = 24_000;

export type { ConfirmationView };

export const SESSION_ERROR_MESSAGE = "Session expirée. Reconnectez-vous.";
export const GENERIC_ERROR_MESSAGE = "Une erreur interne est survenue.";
export const UNAVAILABLE_ERROR_MESSAGE = "Assistant indisponible.";
export const WEB_SEARCH_ERROR_MESSAGE = WEB_SEARCH_UNAVAILABLE_MESSAGE;
export const EMPTY_RESPONSE_MESSAGE = "Aucune réponse.";

export type { ChatSourceLink };

export type ChatRole = "user" | "assistant";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

export class ChatClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatClientError";
  }
}

const SECRETISH =
  /(api[_-]?key|sk-[a-zA-Z0-9]|AUTH_SECRET|DATABASE_URL|GITHUB_TOKEN|OPENAI_API_KEY|password=|Bearer\s+[A-Za-z0-9._-]+)/i;

export function normalizeOutgoingMessage(raw: string) {
  return raw.trim().slice(0, CHAT_MESSAGE_MAX_LENGTH);
}

export function capHistory(history: ChatTurn[]): ChatTurn[] {
  let capped = history.slice(-CHAT_HISTORY_MAX_MESSAGES);
  let chars = capped.reduce((total, item) => total + item.content.length, 0);
  while (capped.length > 0 && chars > CHAT_HISTORY_MAX_CHARS) {
    const removed = capped[0];
    capped = capped.slice(1);
    chars -= removed?.content.length ?? 0;
  }
  return capped;
}

export function toRequestHistory(
  messages: Array<{ role: string; content: string }>,
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const item of messages) {
    if (item.role !== "user" && item.role !== "assistant") {
      continue;
    }
    if (!item.content.trim()) {
      continue;
    }
    turns.push({ role: item.role, content: item.content });
  }
  return capHistory(turns);
}

export function buildChatRequestBody(message: string, history: ChatTurn[]) {
  const body: { message: string; history?: ChatTurn[] } = { message };
  if (history.length > 0) {
    body.history = history.map(({ role, content }) => ({ role, content }));
  }
  return JSON.stringify(body);
}

export function messageFromUnknown(payload: unknown): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const record = payload as Record<string, unknown>;
  if (typeof record.message === "string") {
    return record.message;
  }
  if (typeof record.text === "string") {
    return record.text;
  }
  return "";
}

export function safeClientError(raw: string, status?: number) {
  if (status === 401) {
    return SESSION_ERROR_MESSAGE;
  }

  const trimmed = raw.trim();
  if (isWebSearchErrorText(trimmed)) {
    return WEB_SEARCH_UNAVAILABLE_MESSAGE;
  }
  if (!trimmed || SECRETISH.test(trimmed) || trimmed.length > 280) {
    if (status === 503) {
      return UNAVAILABLE_ERROR_MESSAGE;
    }
    return GENERIC_ERROR_MESSAGE;
  }

  return trimmed;
}

export async function readChatError(response: Response): Promise<string> {
  if (isSessionFailure(response)) {
    return SESSION_ERROR_MESSAGE;
  }

  let raw = "";
  try {
    const payload: unknown = await response.json();
    if (payload && typeof payload === "object") {
      const record = payload as Record<string, unknown>;
      if (typeof record.error === "string") {
        raw = record.error;
      } else if (typeof record.message === "string") {
        raw = record.message;
      }
    }
  } catch {
    raw = "";
  }

  return safeClientError(raw, response.status);
}

export function isSessionFailure(response: Response) {
  if (response.status === 401) {
    return true;
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "";
    return /connexion/i.test(location) || location.length > 0;
  }
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  return contentType.includes("text/html");
}

export function isEventStream(contentType: string | null) {
  return (contentType ?? "").toLowerCase().includes("text/event-stream");
}

export type SseToken =
  | { kind: "delta"; value: string }
  | { kind: "replace"; value: string }
  | { kind: "error"; value: string }
  | { kind: "confirmation"; proposal: ConfirmationView }
  | { kind: "status"; label: string }
  | { kind: "sources"; sources: ChatSourceLink[] }
  | { kind: "skip" };

export type ConsumeEventStreamResult = {
  text: string;
  proposal: ConfirmationView | null;
  sources: ChatSourceLink[];
};

export type ConsumeEventStreamOptions = {
  onProposal?: (proposal: ConfirmationView) => void;
  onStatus?: (label: string) => void;
  onSources?: (sources: ChatSourceLink[]) => void;
};

export function tokenFromSseData(data: string): SseToken {
  const tokens = tokensFromSseData(data);
  return tokens.find((token) => token.kind === "confirmation") ?? tokens[0] ?? { kind: "skip" };
}

export function tokensFromSseData(data: string): SseToken[] {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return [{ kind: "skip" }];
  }

  try {
    const json: unknown = JSON.parse(trimmed);
    return tokensFromSseJson(json);
  } catch {
    return [{ kind: "delta", value: trimmed }];
  }
}

function tokensFromSseJson(json: unknown): SseToken[] {
  const proposal = parseConfirmationPayload(json);
  const status = parseStatusPayload(json);
  const sources = parseSourcesPayload(json);
  const textToken = tokenFromSseJson(json);
  const tokens: SseToken[] = [];
  if (status) {
    tokens.push({ kind: "status", label: status.label });
  }
  if (textToken.kind !== "skip") {
    tokens.push(textToken);
  }
  if (sources.length > 0) {
    tokens.push({ kind: "sources", sources });
  }
  if (proposal) {
    tokens.push({ kind: "confirmation", proposal });
  }
  return tokens.length > 0 ? tokens : [{ kind: "skip" }];
}

function tokenFromSseJson(json: unknown): SseToken {
  if (typeof json === "string") {
    return json === "[DONE]" ? { kind: "skip" } : { kind: "delta", value: json };
  }
  if (!json || typeof json !== "object") {
    return { kind: "skip" };
  }

  const record = json as Record<string, unknown>;
  const type = String(record.type ?? record.event ?? "");
  if (type === "confirmation_required" || type === "proposal" || type === "confirmation") {
    const complete = firstString(record.message, record.text, record.content);
    return complete ? { kind: "replace", value: complete } : { kind: "skip" };
  }
  if (type === "status" || type === "sources" || type === "tool") {
    return { kind: "skip" };
  }
  if (/tool/i.test(type) || typeof record.toolName === "string" || typeof record.tool === "string") {
    return { kind: "skip" };
  }
  if (type === "error" || record.success === false) {
    const message =
      typeof record.error === "string"
        ? record.error
        : typeof record.message === "string"
          ? record.message
          : GENERIC_ERROR_MESSAGE;
    return { kind: "error", value: safeClientError(message) };
  }
  if (type === "start") {
    return { kind: "skip" };
  }
  if (type === "delta") {
    const delta = firstString(record.text, record.delta, record.textDelta, record.token);
    return delta ? { kind: "delta", value: delta } : { kind: "skip" };
  }
  if (type === "done" || type === "finish") {
    const complete = firstString(record.message, record.text);
    return complete ? { kind: "replace", value: complete } : { kind: "skip" };
  }

  const delta = firstString(record.delta, record.textDelta, record.token);
  if (delta) {
    return { kind: "delta", value: delta };
  }

  const complete = firstString(record.message, record.text, record.content);
  if (complete) {
    return { kind: "replace", value: complete };
  }

  return { kind: "skip" };
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

export async function consumeEventStream(
  response: Response,
  onDelta: (chunk: string) => void,
  onProposalOrOptions?: ((proposal: ConfirmationView) => void) | ConsumeEventStreamOptions,
): Promise<ConsumeEventStreamResult> {
  const options: ConsumeEventStreamOptions =
    typeof onProposalOrOptions === "function"
      ? { onProposal: onProposalOrOptions }
      : (onProposalOrOptions ?? {});
  const body = response.body;
  if (!body) {
    return { text: "", proposal: null, sources: [] };
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";
  let usedDeltas = false;
  let proposal: ConfirmationView | null = null;
  let sources: ChatSourceLink[] = [];

  const apply = (token: SseToken) => {
    if (token.kind === "skip") {
      return;
    }
    if (token.kind === "status") {
      options.onStatus?.(token.label);
      return;
    }
    if (token.kind === "sources") {
      sources = mergeChatSources(sources, token.sources);
      options.onSources?.(sources);
      return;
    }
    if (token.kind === "confirmation") {
      proposal = token.proposal;
      options.onProposal?.(token.proposal);
      return;
    }
    if (token.kind === "error") {
      throw new ChatClientError(token.value);
    }
    if (token.kind === "delta") {
      usedDeltas = true;
      assembled += token.value;
      onDelta(token.value);
      return;
    }
    if (!usedDeltas) {
      assembled = token.value;
      onDelta(token.value);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parsed = splitSseEvents(buffer);
    buffer = parsed.rest;
    for (const event of parsed.complete) {
      for (const token of tokensFromSseData(event)) {
        apply(token);
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = splitSseEvents(`${buffer}\n\n`);
    for (const event of parsed.complete) {
      for (const token of tokensFromSseData(event)) {
        apply(token);
      }
    }
  }

  const markdownSources = extractHttpsSourcesFromMarkdown(assembled);
  if (sources.length === 0 && markdownSources.length > 0) {
    sources = markdownSources;
    options.onSources?.(sources);
  }

  return { text: assembled, proposal, sources };
}

export function splitSseEvents(buffer: string) {
  const parts = buffer.split(/\r?\n\r?\n/);
  const rest = parts.pop() ?? "";
  const complete: string[] = [];

  for (const block of parts) {
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length > 0) {
      complete.push(dataLines.join("\n"));
    }
  }

  return { complete, rest };
}
