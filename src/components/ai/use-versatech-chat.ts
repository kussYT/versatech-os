"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
} from "@/components/ai/chat-client";

export type ChatStatus = "idle" | "thinking" | "error";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export function useVersatechChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(async (raw?: string) => {
    const message = normalizeOutgoingMessage(raw ?? draft);
    if (!message || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setDraft("");
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
        const text = await consumeEventStream(response, (chunk) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantId
                ? { ...item, content: `${item.content}${chunk}` }
                : item,
            ),
          );
        });
        if (!text.trim()) {
          setMessages((current) => current.filter((item) => item.id !== assistantId));
          setError(EMPTY_RESPONSE_MESSAGE);
          setStatus("error");
          return;
        }
        setStatus("idle");
        return;
      }

      const payload: unknown = await response.json();
      const text = messageFromUnknown(payload);
      if (!text.trim()) {
        setError(EMPTY_RESPONSE_MESSAGE);
        setStatus("error");
        return;
      }
      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: text },
      ]);
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
      sendingRef.current = false;
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [draft]);

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
