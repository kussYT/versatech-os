"use client";

import {
  useEffect,
  useId,
  useRef,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Send, X } from "lucide-react";
import { useVersatechAi } from "@/components/ai/versatech-ai";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/components/ai/chat-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { controlClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";

export const EMPTY_SUGGESTIONS = [
  "Qu'est-ce que j'ai aujourd'hui ?",
  "Quels prospects dois-je relancer ?",
  "Où en est ALEX'CEPTION ?",
  "Résume mon pipeline.",
  "Qu'ai-je au calendrier cette semaine ?",
] as const;

const STATUS_LABEL: Record<"idle" | "thinking" | "error", string> = {
  idle: "Prêt",
  thinking: "Réflexion…",
  error: "Erreur",
};

export function VersatechAiPanel() {
  const {
    open,
    closePanel,
    messages,
    status,
    error,
    draft,
    setDraft,
    send,
    canSend,
  } = useVersatechAi();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();
  const last = messages.at(-1);
  const waiting =
    status === "thinking" && (!last || last.role === "user" || last.content.trim() === "");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!dialog) {
      return;
    }

    const sync = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      dialog.style.setProperty("--vt-ai-vv-height", `${Math.round(height)}px`);
      dialog.style.setProperty("--vt-ai-vv-offset", `${Math.round(offset)}px`);
    };

    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [open]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "end",
    });
  }, [messages, status, error]);

  function onBackdropPointerDown(event: PointerEvent<HTMLDialogElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) {
      closePanel();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      id="versatech-ai-panel"
      className="vt-ai-panel"
      aria-labelledby={titleId}
      aria-busy={status === "thinking"}
      onClose={closePanel}
      onPointerDown={onBackdropPointerDown}
    >
      <header className="vt-ai-panel-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="brand-gem text-[1.05rem]" aria-hidden="true">
            ✦
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-section text-foreground">
              VersaTech AI
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-meta text-muted" aria-live="polite">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  status === "thinking" && "bg-cyan",
                  status === "error" && "bg-danger",
                  status === "idle" && "bg-faint",
                )}
                aria-hidden="true"
              />
              {STATUS_LABEL[status]}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={closePanel} aria-label="Fermer">
          <X className="size-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="vt-ai-panel-thread" role="log" aria-label="Conversation">
        {messages.length === 0 ? (
          <EmptyConversation
            disabled={status === "thinking"}
            onSuggest={(prompt) => {
              void send(prompt);
            }}
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {messages
              .filter((item) => item.content.trim().length > 0)
              .map((item) => (
              <li key={item.id} className={cn("flex", item.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-body",
                    item.role === "user"
                      ? "rounded-br-md border border-border bg-surface-high text-foreground"
                      : "rounded-bl-md border border-border bg-surface text-foreground card-sheen",
                  )}
                >
                  {item.content}
                </div>
              </li>
            ))}
          </ol>
        )}

        {waiting ? (
          <div className="mt-3 max-w-[92%] space-y-2 rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-3">
            <Skeleton className="h-3 w-[88%]" />
            <Skeleton className="h-3 w-[62%]" />
            <Skeleton className="h-3 w-[74%]" />
            <span className="sr-only">Réflexion en cours</span>
          </div>
        ) : null}

        {error ? (
          <p className="mt-3 text-meta text-danger" role="alert">
            {error}
          </p>
        ) : null}

        <div ref={logEndRef} />
      </div>

      <form className="vt-ai-panel-composer pb-safe" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="sr-only">
          Message pour VersaTech AI
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          name="message"
          rows={2}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder="Demander le briefing, une relance, un compte…"
          className={cn(controlClassName, "min-h-12 max-h-32 min-w-0 flex-1 resize-none")}
          autoComplete="off"
          spellCheck
        />
        <Button
          type="submit"
          size="icon"
          className="shrink-0 self-end"
          disabled={!canSend}
          aria-label="Envoyer"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </dialog>
  );
}

function EmptyConversation({
  disabled,
  onSuggest,
}: {
  disabled: boolean;
  onSuggest: (prompt: string) => void;
}) {
  return (
    <div>
      <p className="text-body font-medium text-muted">Opérateur du cockpit</p>
      <p className="mt-1 max-w-md text-meta text-muted">
        Questions sur la journée, les relances, une entreprise ou le pipeline. Les
        réponses viennent des données persistées, jamais inventées.
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {EMPTY_SUGGESTIONS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSuggest(prompt)}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-meta text-muted shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)] transition-colors duration-hover hover:border-primary/40 hover:text-foreground disabled:opacity-50"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
