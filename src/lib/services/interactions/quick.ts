import { z } from "zod";
import type { InteractionDirection, InteractionResult } from "@/generated/prisma/client";
import {
  followUpDueAtAfterCivilDays,
  followUpDueAtOnCivilDate,
  parisParts,
} from "@/lib/dates";

export const QUICK_INTERACTION_TYPES = ["CALL", "MESSAGE", "EMAIL", "MEETING", "NOTE"] as const;
export type QuickInteractionType = (typeof QUICK_INTERACTION_TYPES)[number];

export const MESSAGE_CHANNELS = ["Instagram", "WhatsApp", "SMS", "LinkedIn", "Autre"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

export const FOLLOW_UP_PRESETS = ["tomorrow", "in3Days", "in1Week", "custom", "none"] as const;
export type FollowUpPreset = (typeof FOLLOW_UP_PRESETS)[number];

export const CALL_OUTCOMES = ["answered", "no_answer"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

const PRESET_DAYS: Record<Exclude<FollowUpPreset, "custom" | "none">, number> = {
  tomorrow: 1,
  in3Days: 3,
  in1Week: 7,
};

export const quickInteractionInputSchema = z
  .object({
    companyId: z.string().min(1, "Entreprise introuvable"),
    opportunityId: z.string().min(1).nullable().optional(),
    type: z.enum(QUICK_INTERACTION_TYPES, { error: "Type d'interaction invalide" }),
    callOutcome: z.enum(CALL_OUTCOMES).nullable(),
    channel: z.enum(MESSAGE_CHANNELS).nullable(),
    notes: z.string().trim().max(4000, "La note est trop longue").nullable(),
    followUp: z.enum(FOLLOW_UP_PRESETS, { error: "Relance invalide" }),
    customDueDate: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "CALL" && !value.callOutcome) {
      ctx.addIssue({
        code: "custom",
        path: ["callOutcome"],
        message: "Indiquez si l'appel a abouti.",
      });
    }
    if (value.type !== "CALL" && value.callOutcome) {
      ctx.addIssue({
        code: "custom",
        path: ["callOutcome"],
        message: "Le résultat d'appel ne s'applique qu'à un appel.",
      });
    }
    if (value.type === "NOTE" && !value.notes) {
      ctx.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Écrivez la note.",
      });
    }
    if (value.type === "NOTE" && value.followUp !== "none") {
      ctx.addIssue({
        code: "custom",
        path: ["followUp"],
        message: "Une note ne programme pas de relance.",
      });
    }
    if (value.type !== "MESSAGE" && value.channel) {
      ctx.addIssue({
        code: "custom",
        path: ["channel"],
        message: "Le canal ne s'applique qu'à un message.",
      });
    }
    if (value.followUp === "custom" && !followUpDueAtOnCivilDate(value.customDueDate ?? "")) {
      ctx.addIssue({
        code: "custom",
        path: ["customDueDate"],
        message: "Choisissez une date valide.",
      });
    }
  });

export type QuickInteractionInput = z.infer<typeof quickInteractionInputSchema>;

export function quickInteractionDirection(type: QuickInteractionType): InteractionDirection {
  return type === "NOTE" ? "INTERNAL" : "OUTBOUND";
}

export function quickInteractionResult(
  type: QuickInteractionType,
  callOutcome: CallOutcome | null,
): InteractionResult | null {
  if (type === "CALL" && callOutcome === "no_answer") {
    return "NO_ANSWER";
  }
  return null;
}

/** Canal d'un message, dans `Interaction.subject` — pas de colonne dédiée. */
export function quickInteractionSubject(
  type: QuickInteractionType,
  channel: MessageChannel | null,
): string | null {
  if (type === "MESSAGE" && channel) {
    return channel;
  }
  return null;
}

export function quickFollowUpTitle(type: QuickInteractionType, callOutcome: CallOutcome | null): string {
  if (type === "CALL" && callOutcome === "no_answer") {
    return "Relancer — appel sans réponse";
  }
  if (type === "CALL") {
    return "Relancer — appel";
  }
  if (type === "MESSAGE") {
    return "Relancer — message";
  }
  if (type === "EMAIL") {
    return "Relancer — e-mail";
  }
  if (type === "MEETING") {
    return "Relancer — rendez-vous";
  }
  return "Relance";
}

export function resolveQuickFollowUpDueAt(
  followUp: FollowUpPreset,
  customDueDate: string | null,
  now: Date,
): Date | null {
  if (followUp === "none") {
    return null;
  }
  if (followUp === "custom") {
    return followUpDueAtOnCivilDate(customDueDate ?? "");
  }
  return followUpDueAtAfterCivilDays(PRESET_DAYS[followUp], now);
}

export function quickInteractionFeedback(followUpDueAt: Date | null): string {
  if (!followUpDueAt) {
    return "Interaction enregistrée";
  }
  const parts = parisParts(followUpDueAt);
  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  return `Interaction enregistrée · Relance le ${day}/${month}`;
}
