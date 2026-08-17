// ─── Intent Types ───────────────────────────────────────────────────────────
// Closed-vocabulary intent enum and entity schemas for the LLM extraction layer.
// The agent produces ONLY these structured objects — never prose, never direct DB calls.

import { z } from 'zod';

/**
 * Fixed enum of all supported warehouse intents.
 * The LLM is constrained to output exactly one of these values.
 */
export enum IntentType {
  GOODS_RECEIPT = 'goods_receipt',
  PICK = 'pick',
  PUTAWAY = 'putaway',
  CYCLE_COUNT = 'cycle_count',
  DAMAGE_REPORT = 'damage_report',
  TRANSFER = 'transfer',
  UNDO_LAST = 'undo_last',
}

// ─── Entity Schemas (per intent) ────────────────────────────────────────────

export const GoodsReceiptEntitiesSchema = z.object({
  sku: z.string().describe('SKU code'),
  location: z.string().describe('Destination location code'),
  quantity_good: z.number().int().nonnegative().describe('Good units received'),
  quantity_damaged: z.number().int().nonnegative().default(0).describe('Damaged units received'),
  purchase_order: z.string().optional().describe('PO reference if mentioned'),
});

export const PickEntitiesSchema = z.object({
  sku: z.string().describe('SKU code to pick'),
  location: z.string().describe('Pick location code'),
  quantity: z.number().int().positive().describe('Quantity to pick'),
  order_id: z.string().optional().describe('Order reference if mentioned'),
});

export const PutawayEntitiesSchema = z.object({
  sku: z.string().describe('SKU code'),
  source_location: z.string().optional().describe('Source location (e.g., receiving dock)'),
  destination_location: z.string().describe('Destination location code'),
  quantity: z.number().int().positive().describe('Quantity to put away'),
});

export const CycleCountEntitiesSchema = z.object({
  sku: z.string().describe('SKU code'),
  location: z.string().describe('Location code being counted'),
  quantity_good: z.number().int().nonnegative().describe('Counted good units'),
  quantity_damaged: z.number().int().nonnegative().default(0).describe('Counted damaged units'),
});

export const DamageReportEntitiesSchema = z.object({
  sku: z.string().describe('SKU code'),
  location: z.string().describe('Location where damage was found'),
  quantity: z.number().int().positive().describe('Number of damaged units'),
  reason: z.string().optional().describe('Reason/description of damage'),
});

export const TransferEntitiesSchema = z.object({
  sku: z.string().describe('SKU code'),
  source_location: z.string().describe('Source location code'),
  destination_location: z.string().describe('Destination location code'),
  quantity: z.number().int().positive().describe('Quantity to transfer'),
});

export const UndoLastEntitiesSchema = z.object({
  action_id: z.string().optional().describe('Specific action ID to undo, if mentioned'),
});

// ─── Entity schema map ──────────────────────────────────────────────────────

export const ENTITY_SCHEMAS: Record<IntentType, z.ZodTypeAny> = {
  [IntentType.GOODS_RECEIPT]: GoodsReceiptEntitiesSchema,
  [IntentType.PICK]: PickEntitiesSchema,
  [IntentType.PUTAWAY]: PutawayEntitiesSchema,
  [IntentType.CYCLE_COUNT]: CycleCountEntitiesSchema,
  [IntentType.DAMAGE_REPORT]: DamageReportEntitiesSchema,
  [IntentType.TRANSFER]: TransferEntitiesSchema,
  [IntentType.UNDO_LAST]: UndoLastEntitiesSchema,
};

// ─── Parsed Intent (the LLM's output shape) ────────────────────────────────

export const ParsedIntentSchema = z.object({
  intent: z.nativeEnum(IntentType),
  entities: z.record(z.string(), z.unknown()),
  confidence: z.number().min(0).max(1),
  ambiguities: z.array(z.string()).default([]),
});

export type ParsedIntent = z.infer<typeof ParsedIntentSchema>;

export type GoodsReceiptEntities = z.infer<typeof GoodsReceiptEntitiesSchema>;
export type PickEntities = z.infer<typeof PickEntitiesSchema>;
export type PutawayEntities = z.infer<typeof PutawayEntitiesSchema>;
export type CycleCountEntities = z.infer<typeof CycleCountEntitiesSchema>;
export type DamageReportEntities = z.infer<typeof DamageReportEntitiesSchema>;
export type TransferEntities = z.infer<typeof TransferEntitiesSchema>;
export type UndoLastEntities = z.infer<typeof UndoLastEntitiesSchema>;

// ─── Session Context (fed to LLM alongside transcript) ─────────────────────

export interface SessionContext {
  warehouseId: string;
  warehouseName: string;
  userId: string;
  userName: string;
  userRole: string;
  sessionId: string;
  /** SKU catalog for this warehouse — for entity grounding */
  skuCatalog: Array<{ code: string; description: string; id: string }>;
  /** Location catalog for this warehouse — for entity grounding */
  locationCatalog: Array<{ code: string; zone: string; id: string }>;
}

// ─── OpenAI function definition (JSON Schema for function calling) ──────────

export function getIntentExtractionFunctionDef() {
  return {
    name: 'extract_warehouse_intent',
    description:
      'Extract the warehouse operation intent and entities from a spoken transcript. ' +
      'Always resolve SKU codes and location codes against the provided catalog.',
    parameters: {
      type: 'object' as const,
      properties: {
        intent: {
          type: 'string',
          enum: Object.values(IntentType),
          description: 'The warehouse operation intent',
        },
        entities: {
          type: 'object',
          description: 'Extracted entities specific to the intent type',
          properties: {
            sku: { type: 'string', description: 'SKU code from the catalog' },
            location: { type: 'string', description: 'Location code from the catalog' },
            source_location: { type: 'string', description: 'Source location code' },
            destination_location: { type: 'string', description: 'Destination location code' },
            quantity: { type: 'number', description: 'Quantity' },
            quantity_good: { type: 'number', description: 'Good quantity' },
            quantity_damaged: { type: 'number', description: 'Damaged quantity' },
            purchase_order: { type: 'string', description: 'Purchase order reference' },
            order_id: { type: 'string', description: 'Order reference' },
            reason: { type: 'string', description: 'Reason or description' },
            action_id: { type: 'string', description: 'Action ID to undo' },
          },
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence score for the extraction (0-1)',
        },
        ambiguities: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of ambiguous parts in the transcript that need clarification',
        },
      },
      required: ['intent', 'entities', 'confidence', 'ambiguities'],
    },
  };
}
