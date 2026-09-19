"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  cancelProposedAction,
  canOpenWriteProposal,
  CONFIRMATION_PROMPT_MESSAGE,
  confirmProposedAction,
  createDoubleSubmitGuard,
  isProposalExecutable,
  parseConfirmationFromChatResponse,
  type ConfirmationView,
} from "@/components/ai/confirmation";
import {
  CHAT_ENDPOINT,
  ChatClientError,
  EMPTY_RESPONSE_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  buildChatRequestBody,
  consumeEventStream,
  isEventStream,
  isSessionFailure,
  messageFromUnknown,
  normalizeOutgoingMessage,
  readChatError,
  safeClientError,
  toRequestHistory,
  type ChatRole,
  type ChatSourceLink,
} from "@/components/ai/chat-client";
import { extractHttpsSourcesFromMarkdown, parseSourcesPayload } from "@/components/ai/sources";

export type ChatStatus = "idle" | "thinking" | "error";

export type ConfirmationCardStatus = "idle" | "confirming" | "success" | "error" | "expired";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  proposal?: ConfirmationView;
  confirmationStatus?: ConfirmationCardStatus;
  confirmationMessage?: string;
  sources?: ChatSourceLink[];
};

export function useVersatechChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [activityLabel, setActivityLabel] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const messagesRef = useRef(messages);
  const confirmGuardRef = useRef(createDoubleSubmitGuard());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const attachSources = useCallback((messageId: string, sources: ChatSourceLink[]) => {
    if (sources.length === 0) {
      return;
    }
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId ? { ...item, sources } : item,
      ),
    );
  }, []);

  const attachProposal = useCallback((messageId: string, proposal: ConfirmationView | null) => {
    if (!proposal) {
      return;
    }
    setMessages((current) => {
      const alreadyOpen = current.filter((item) => item.proposal && item.confirmationStatus !== "success")
        .length;
      if (!canOpenWriteProposal(alreadyOpen) && !current.some((item) => item.id === messageId && item.proposal)) {
        return current;
      }
      return current.map((item) =>
        item.id === messageId
          ? {
              ...item,
              proposal,
              confirmationStatus: proposal.blockedReason === "EXPIRED" ? "expired" : "idle",
            }
          : item,
      );
    });
  }, []);

  const send = useCallback(async (raw?: string) => {
    const message = normalizeOutgoingMessage(raw ?? draft);
    if (!message || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setDraft("");
    setActivityLabel(null);
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: message,
    };
    const history = toRequestHistory(messagesRef.current);
    setMessages((current) => [...current, userMessage]);
    setStatus("thinking");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        credentials: "include",
        redirect: "manual",
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        body: buildChatRequestBody(message, history),
        signal: controller.signal,
      });

      if (!response.ok || isSessionFailure(response)) {
        setError(await readChatError(response));
        setStatus("error");
        return;
      }

      if (isEventStream(response.headers.get("content-type"))) {
        const assistantId = createId();
        setMessages((current) => [
          ...current,
          { id: assistantId, role: "assistant", content: "" },
        ]);
        const streamed = await consumeEventStream(
          response,
          (chunk) => {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? { ...item, content: `${item.content}${chunk}` }
                  : item,
              ),
            );
          },
          {
            onProposal: (proposal) => {
              attachProposal(assistantId, proposal);
            },
            onStatus: (label) => {
              setActivityLabel(label.length > 0 ? label : null);
            },
            onSources: (nextSources) => {
              attachSources(assistantId, nextSources);
              setActivityLabel(null);
            },
          },
        );
        const text = streamed.text.trim();
        const proposal = streamed.proposal;
        const sources =
          streamed.sources.length > 0
            ? streamed.sources
            : extractHttpsSourcesFromMarkdown(streamed.text);
        if (proposal) {
          attachProposal(assistantId, proposal);
        }
        if (sources.length > 0) {
          attachSources(assistantId, sources);
        }
        if (!text && !proposal && sources.length === 0) {
          setMessages((current) => current.filter((item) => item.id !== assistantId));
          setError(EMPTY_RESPONSE_MESSAGE);
          setStatus("error");
          return;
        }
        if (!text && proposal) {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId && !item.content.trim()
                ? { ...item, content: CONFIRMATION_PROMPT_MESSAGE }
                : item,
            ),
          );
        }
        setActivityLabel(null);
        setStatus("idle");
        return;
      }

      const payload: unknown = await response.json();
      const text = messageFromUnknown(payload).trim();
      const parsedProposal = parseConfirmationFromChatResponse(payload);
      const payloadSources = (() => {
        const fromPayload = parseSourcesPayload(payload);
        return fromPayload.length > 0 ? fromPayload : extractHttpsSourcesFromMarkdown(text);
      })();
      if (!text && !parsedProposal && payloadSources.length === 0) {
        setError(EMPTY_RESPONSE_MESSAGE);
        setStatus("error");
        return;
      }
      const assistantId = createId();
      setMessages((current) => {
        const alreadyOpen = current.filter(
          (item) => item.proposal && item.confirmationStatus !== "success",
        ).length;
        const proposal =
          parsedProposal && canOpenWriteProposal(alreadyOpen) ? parsedProposal : undefined;
        return [
          ...current,
          {
            id: assistantId,
            role: "assistant",
            content: text || (proposal ? CONFIRMATION_PROMPT_MESSAGE : ""),
            proposal,
            confirmationStatus: proposal
              ? proposal.blockedReason === "EXPIRED"
                ? "expired"
                : "idle"
              : undefined,
            sources: payloadSources.length > 0 ? payloadSources : undefined,
          },
        ];
      });
      setActivityLabel(null);
      setStatus("idle");
    } catch (caught) {
      if (isAbortError(caught)) {
        return;
      }
      if (caught instanceof ChatClientError) {
        setError(safeClientError(caught.message));
        setStatus("error");
        return;
      }
      setError(GENERIC_ERROR_MESSAGE);
      setStatus("error");
    } finally {
      setActivityLabel(null);
      sendingRef.current = false;
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [attachProposal, attachSources, draft]);

  const cancelProposal = useCallback((messageId: string) => {
    if (confirmingId === messageId) {
      return;
    }
    cancelProposedAction();
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId
          ? { id: item.id, role: item.role, content: item.content, sources: item.sources }
          : item,
      ),
    );
  }, [confirmingId]);

  const confirmProposal = useCallback(async (messageId: string) => {
    await confirmGuardRef.current.run(async () => {
      const target = messagesRef.current.find((item) => item.id === messageId);
      const proposal = target?.proposal;
      if (!proposal || !isProposalExecutable(proposal)) {
        return;
      }

      setConfirmingId(messageId);
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, confirmationStatus: "confirming" } : item,
        ),
      );

      try {
        const result = await confirmProposedAction({
          token: proposal.token,
          actionId: proposal.actionId,
        });
        if (result.ok) {
          setMessages((current) =>
            current.map((item) =>
              item.id === messageId
                ? {
                    ...item,
                    confirmationStatus: "success",
                    confirmationMessage: result.message,
                  }
                : item,
            ),
          );
          return;
        }
        if (result.reason === "expired") {
          setMessages((current) =>
            current.map((item) =>
              item.id === messageId
                ? {
                    ...item,
                    proposal: { ...proposal, executable: false, blockedReason: "EXPIRED" },
                    confirmationStatus: "expired",
                    confirmationMessage: result.message,
                  }
                : item,
            ),
          );
          return;
        }
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  confirmationStatus: "error",
                  confirmationMessage: result.message,
                }
              : item,
          ),
        );
      } catch {
        setMessages((current) =>
          current.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  confirmationStatus: "error",
                  confirmationMessage: GENERIC_ERROR_MESSAGE,
                }
              : item,
          ),
        );
      } finally {
        setConfirmingId(null);
      }
    });
  }, []);

  const canSend =
    status !== "thinking" && normalizeOutgoingMessage(draft).length > 0;

  return {
    messages,
    status,
    error,
    draft,
    setDraft,
    send,
    canSend,
    confirmProposal,
    cancelProposal,
    confirmingId,
    activityLabel,
  };
}

function createId() {
  return crypto.randomUUID();
}

function isAbortError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "name" in error &&
      (error.name === "AbortError" || error.name === "TimeoutError"),
  );
}
