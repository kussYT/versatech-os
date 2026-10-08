"use client";

import { useState, useTransition } from "react";
import {
  CalendarClock,
  Mail,
  MessageSquare,
  NotebookPen,
  Phone,
} from "lucide-react";
import { recordQuickInteraction } from "@/actions/interactions";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import type {
  CallOutcome,
  FollowUpPreset,
  MessageChannel,
  QuickInteractionType,
} from "@/lib/services/interactions/quick";

const TYPES: { type: QuickInteractionType; label: string; icon: typeof Phone }[] = [
  { type: "CALL", label: "Appel", icon: Phone },
  { type: "MESSAGE", label: "Message", icon: MessageSquare },
  { type: "EMAIL", label: "Email", icon: Mail },
  { type: "MEETING", label: "RDV", icon: CalendarClock },
  { type: "NOTE", label: "Note", icon: NotebookPen },
];

const CHANNELS: MessageChannel[] = ["Instagram", "WhatsApp", "SMS", "LinkedIn", "Autre"];

const PRESETS: { preset: FollowUpPreset; label: string }[] = [
  { preset: "tomorrow", label: "Demain" },
  { preset: "in3Days", label: "Dans 3 jours" },
  { preset: "in1Week", label: "Dans 1 semaine" },
  { preset: "none", label: "Pas de relance" },
];

type QuickInteractionPanelProps = {
  companyId: string;
  opportunityId?: string | null;
  onClose: () => void;
  onOpenFullForm: () => void;
  onSaved: (message: string) => void;
};

export function QuickInteractionPanel({
  companyId,
  opportunityId = null,
  onClose,
  onOpenFullForm,
  onSaved,
}: QuickInteractionPanelProps) {
  const [type, setType] = useState<QuickInteractionType | null>(null);
  const [callOutcome, setCallOutcome] = useState<CallOutcome | null>(null);
  const [channel, setChannel] = useState<MessageChannel | null>(null);
  const [notes, setNotes] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(followUp: FollowUpPreset, outcome: CallOutcome | null = callOutcome) {
    if (!type || pending) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await recordQuickInteraction({
        companyId,
        opportunityId,
        type,
        callOutcome: type === "CALL" ? outcome : null,
        channel: type === "MESSAGE" ? channel : null,
        notes: notes.trim() ? notes.trim() : null,
        followUp,
        customDueDate: followUp === "custom" ? customDate : null,
      });
      if (!result.ok) {
        setError(result.message ?? "Impossible d'enregistrer l'interaction.");
        return;
      }
      onSaved(result.message ?? "Interaction enregistrée");
      onClose();
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-section text-foreground">+ Interaction</h2>
          <p className="mt-1 text-meta text-muted">Quelques secondes, sans quitter la fiche.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Fermer
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-meta text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TYPES.map((item) => {
          const Icon = item.icon;
          const selected = type === item.type;
          return (
            <button
              key={item.type}
              type="button"
              disabled={pending}
              onClick={() => {
                setType(item.type);
                setCallOutcome(null);
                setShowCustomDate(false);
                setError(null);
              }}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-body font-medium",
                selected
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-background/60 text-muted",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {type === "CALL" && !callOutcome ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button className="min-h-12" disabled={pending} onClick={() => setCallOutcome("answered")}>
            Répondu
          </Button>
          <Button
            className="min-h-12"
            variant="secondary"
            disabled={pending}
            onClick={() => setCallOutcome("no_answer")}
          >
            Pas répondu
          </Button>
        </div>
      ) : null}

      {type === "CALL" && callOutcome === "answered" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-meta text-faint" htmlFor="quick-call-note">
            Note (facultative)
          </label>
          <textarea
            id="quick-call-note"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={pending}
            placeholder="Intéressée, veut recevoir une proposition."
            className={controlClassName}
          />
          <Button className="min-h-12" disabled={pending} onClick={() => submit("none", "answered")}>
            Enregistrer
          </Button>
        </div>
      ) : null}

      {type === "MESSAGE" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {CHANNELS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={pending}
              onClick={() => setChannel(channel === item ? null : item)}
              className={cn(
                "min-h-11 rounded-xl border px-3 text-body",
                channel === item
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border text-muted",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {type === "NOTE" ? (
        <div className="mt-4 space-y-3">
          <label className="block text-meta text-faint" htmlFor="quick-note">
            Note
          </label>
          <textarea
            id="quick-note"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            disabled={pending}
            className={controlClassName}
          />
          <Button className="min-h-12" disabled={pending || notes.trim().length === 0} onClick={() => submit("none")}>
            Enregistrer
          </Button>
        </div>
      ) : null}

      {(type === "MESSAGE" || type === "EMAIL" || type === "MEETING" || (type === "CALL" && callOutcome === "no_answer")) ? (
        <div className="mt-4 space-y-3">
          {type !== "CALL" ? (
            <>
              <label className="block text-meta text-faint" htmlFor="quick-note-optional">
                Note (facultative)
              </label>
              <textarea
                id="quick-note-optional"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                disabled={pending}
                className={controlClassName}
              />
            </>
          ) : null}
          <p className="text-meta text-faint">Relancer</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((item) => (
              <Button
                key={item.preset}
                className="min-h-12"
                variant={item.preset === "none" ? "ghost" : "secondary"}
                disabled={pending}
                onClick={() => submit(item.preset)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {showCustomDate ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="date"
                value={customDate}
                onChange={(event) => setCustomDate(event.target.value)}
                disabled={pending}
                className={cn(controlClassName, "min-h-12")}
                aria-label="Date de relance"
              />
              <Button
                className="min-h-12"
                disabled={pending || !customDate}
                onClick={() => submit("custom")}
              >
                Enregistrer cette date
              </Button>
            </div>
          ) : (
            <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setShowCustomDate(true)}>
              Choisir une date
            </Button>
          )}
        </div>
      ) : null}

      <button
        type="button"
        className="mt-4 text-meta text-muted underline-offset-2 hover:underline"
        onClick={onOpenFullForm}
      >
        Formulaire complet
      </button>
    </div>
  );
}
