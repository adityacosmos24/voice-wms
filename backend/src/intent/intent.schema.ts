// ─── Intent Schemas ─────────────────────────────────────────────────────────
// JSON schemas for OpenAI function calling. Matches the Zod schemas from intent.types.ts.

export const openaiFunctionSchema = {
  name: 'extract_warehouse_intent',
  description: 'Extract a warehouse operation command from user speech or text.',
  parameters: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'goods_receipt',
          'pick',
          'putaway',
          'cycle_count',
          'damage_report',
          'transfer',
          'undo_last',
        ],
        description: 'The type of warehouse operation.',
      },
      entities: {
        type: 'object',
        description: 'The extracted entities specific to the operation. Follow the required fields for the specific intent type.',
        properties: {
          sku: { type: 'string', description: 'The SKU code or product name (e.g., SKU-1001, Widget Alpha)' },
          location: { type: 'string', description: 'The location code (e.g., BAY-A, RACK-1)' },
          source_location: { type: 'string', description: 'Source location for transfers' },
          destination_location: { type: 'string', description: 'Destination location for transfers or putaways' },
          quantity: { type: 'number', description: 'The quantity to operate on' },
          quantity_good: { type: 'number', description: 'The quantity of good stock (used in receipt or cycle count)' },
          quantity_damaged: { type: 'number', description: 'The quantity of damaged stock' },
          reason: { type: 'string', description: 'Reason for damage or adjustment' },
        },
      },
      confidence: {
        type: 'number',
        description: 'Your confidence in the extracted intent and entities (0.0 to 1.0). Lower this if the input is ambiguous or missing crucial data.',
      },
      ambiguities: {
        type: 'array',
        items: { type: 'string' },
        description: 'A list of any ambiguities or missing information in the input (e.g., "quantity not specified", "location sounds like RACK-A or RACK-8").',
      },
    },
    required: ['intent', 'entities', 'confidence', 'ambiguities'],
  },
};
