import type {
  InteractionDirection,
  InteractionResult,
  InteractionType,
} from "@/generated/prisma/client";

export const INTERACTION_TYPE_LABELS: Record<
  Extract<InteractionType, "CALL" | "EMAIL" | "MEETING" | "MESSAGE" | "NOTE">,
  string
> = {
  CALL: "Appel",
  EMAIL: "E-mail",
  MEETING: "RDV",
  MESSAGE: "Message",
  NOTE: "Note",
};

export const INTERACTION_DIRECTION_LABELS: Record<InteractionDirection, string> = {
  INBOUND: "Entrant",
  OUTBOUND: "Sortant",
  INTERNAL: "Interne",
};

export const INTERACTION_RESULT_LABELS: Record<InteractionResult, string> = {
  NO_ANSWER: "Pas de réponse",
  GATEKEEPER: "Standard / filtre",
  CALLBACK: "Rappeler",
  INTERESTED: "Intéressé",
  NOT_INTERESTED: "Pas intéressé",
  MEETING_BOOKED: "RDV posé",
  OTHER: "Autre",
};
