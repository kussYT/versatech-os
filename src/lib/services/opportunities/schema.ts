/**
 * Pipeline READ DTOs — money strings + effectiveProbability / weightedMoney.
 * Ce n'est pas du CA signé. Pas de Prisma, pas de `href`, pas d'industry V1.
 */
import { z } from "zod";
import { tryParseMoneyToCents } from "@/lib/money";

export const PIPELINE_LIMITS = {
  defaultPerStage: 8,
  maxPerStage: 15,
} as const;

export const OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
  "WON",
  "LOST",
] as const;

export const OPEN_OPPORTUNITY_STAGES = [
  "TO_QUALIFY",
  "TO_CONTACT",
  "CONTACTED",
  "INTERESTED",
  "MEETING",
  "QUOTE",
] as const;

export const INTERACTION_TYPES = [
  "CALL",
  "EMAIL",
  "MEETING",
  "MESSAGE",
  "NOTE",
  "QUOTE",
  "PAYMENT",
  "OTHER",
] as const;

const CANONICAL_MONEY_RE = /^-?\d+\.\d{2}$/;
const ISO_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export const moneyStringSchema = z.string().refine((value) => {
  if (!CANONICAL_MONEY_RE.test(value)) {
    return false;
  }
  return tryParseMoneyToCents(value) !== null;
}, 'Montant invalide (string money canonique, ex. "1234.56")');

export const isoDateTimeStringSchema = z.string().refine((value) => {
  if (!ISO_INSTANT_RE.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}, "Date ISO 8601 invalide (attendu Date.toISOString())");

const nonNegativeIntSchema = z.number().int().min(0);

export const getPipelineInputSchema = z.strictObject({
  openOnly: z.boolean().default(true),
  limitPerStage: z
    .number()
    .int()
    .min(1)
    .max(PIPELINE_LIMITS.maxPerStage)
    .default(PIPELINE_LIMITS.defaultPerStage),
});

export const pipelineCountsSchema = z.strictObject({
  TO_QUALIFY: nonNegativeIntSchema,
  TO_CONTACT: nonNegativeIntSchema,
  CONTACTED: nonNegativeIntSchema,
  INTERESTED: nonNegativeIntSchema,
  MEETING: nonNegativeIntSchema,
  QUOTE: nonNegativeIntSchema,
  WON: nonNegativeIntSchema,
  LOST: nonNegativeIntSchema,
});

export const pipelineCardSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  stage: z.enum(OPPORTUNITY_STAGES),
  estimatedValue: moneyStringSchema,
  probability: z.number().int().min(0).max(100),
  weightedValue: moneyStringSchema,
  company: z.strictObject({
    id: z.string().min(1),
    name: z.string().min(1),
    city: z.string().nullable(),
  }),
  nextFollowUp: z
    .strictObject({
      title: z.string().min(1),
      dueAt: isoDateTimeStringSchema,
    })
    .nullable(),
  lastInteraction: z
    .strictObject({
      type: z.enum(INTERACTION_TYPES),
      occurredAt: isoDateTimeStringSchema,
    })
    .nullable(),
});

export const pipelineStageSchema = z
  .strictObject({
    stage: z.enum(OPPORTUNITY_STAGES),
    count: nonNegativeIntSchema,
    estimatedTotal: moneyStringSchema,
    weightedTotal: moneyStringSchema,
    opportunities: z.array(pipelineCardSchema).max(PIPELINE_LIMITS.maxPerStage),
  })
  .superRefine((column, ctx) => {
    if (column.opportunities.length > column.count) {
      ctx.addIssue({
        code: "custom",
        message: "Le nombre de cartes ne peut pas dépasser count.",
        path: ["opportunities"],
      });
    }
    if (column.opportunities.some((card) => card.stage !== column.stage)) {
      ctx.addIssue({
        code: "custom",
        message: "Chaque carte doit avoir le stage de sa colonne.",
        path: ["opportunities"],
      });
    }
  });

export const pipelineSchema = z
  .strictObject({
    openCount: nonNegativeIntSchema,
    brutTotal: moneyStringSchema,
    weightedTotal: moneyStringSchema,
    counts: pipelineCountsSchema,
    stages: z.array(pipelineStageSchema).max(OPPORTUNITY_STAGES.length),
  })
  .superRefine((pipeline, ctx) => {
    const stages = pipeline.stages.map((column) => column.stage);
    if (new Set(stages).size !== stages.length) {
      ctx.addIssue({
        code: "custom",
        message: "stages ne doit pas dupliquer un stage.",
        path: ["stages"],
      });
    }
  });

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type OpenOpportunityStage = (typeof OPEN_OPPORTUNITY_STAGES)[number];
export type InteractionType = (typeof INTERACTION_TYPES)[number];
export type PipelineCardDto = z.infer<typeof pipelineCardSchema>;
export type PipelineStageDto = z.infer<typeof pipelineStageSchema>;
export type PipelineDto = z.infer<typeof pipelineSchema>;
export type PipelineCounts = z.infer<typeof pipelineCountsSchema>;
export type GetPipelineParsed = z.output<typeof getPipelineInputSchema>;

export const EMPTY_PIPELINE_COUNTS: PipelineCounts = {
  TO_QUALIFY: 0,
  TO_CONTACT: 0,
  CONTACTED: 0,
  INTERESTED: 0,
  MEETING: 0,
  QUOTE: 0,
  WON: 0,
  LOST: 0,
};

/** Services throw this before any Prisma load. Never redirect. */
export function requireServiceActor(actor: { id?: string } | null | undefined) {
  if (!actor?.id) {
    throw new Error("Acteur requis.");
  }
}

export function emptyPipeline(openOnly = true): PipelineDto {
  const stages = (openOnly ? OPEN_OPPORTUNITY_STAGES : OPPORTUNITY_STAGES).map((stage) => ({
    stage,
    count: 0,
    estimatedTotal: "0.00",
    weightedTotal: "0.00",
    opportunities: [],
  }));

  return parsePipeline({
    openCount: 0,
    brutTotal: "0.00",
    weightedTotal: "0.00",
    counts: { ...EMPTY_PIPELINE_COUNTS },
    stages,
  });
}

export function clampCollection<T>(items: readonly T[], limit: number): T[] {
  return items.slice(0, limit);
}

export function parseGetPipelineInput(input: unknown): GetPipelineParsed {
  return getPipelineInputSchema.parse(input);
}

export function parsePipeline(input: unknown): PipelineDto {
  return pipelineSchema.parse(input);
}

export function serializePipeline(input: unknown): string {
  return JSON.stringify(parsePipeline(input));
}

export function isPlainJsonValue(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "boolean") {
    return true;
  }
  if (valueType === "number") {
    return Number.isFinite(value);
  }
  if (valueType !== "object") {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every(isPlainJsonValue);
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    return false;
  }

  return Object.values(value as Record<string, unknown>).every(isPlainJsonValue);
}
