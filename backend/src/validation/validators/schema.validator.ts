// ─── Schema Validator ───────────────────────────────────────────────────────
// Sub-layer 1: Does the parsed intent JSON match the expected shape?
// Uses Zod to validate structure, required fields, and types.

import { Injectable } from '@nestjs/common';
import {
  ParsedIntentSchema,
  ENTITY_SCHEMAS,
  IntentType,
  type ParsedIntent,
} from '../../common/types/intent.types';
import type { SubValidationResult } from '../../common/types/validation.types';

@Injectable()
export class SchemaValidator {
  /**
   * Validate that the parsed intent JSON matches the expected shape
   * for the given intent type.
   */
  validate(parsedIntent: unknown): SubValidationResult {
    const errors: string[] = [];

    // 1. Validate overall shape
    const outerResult = ParsedIntentSchema.safeParse(parsedIntent);
    if (!outerResult.success) {
      return {
        validator: 'schema',
        passed: false,
        errors: outerResult.error.issues.map(
          (i) => `${i.path.join('.')}: ${i.message}`,
        ),
      };
    }

    const intent = outerResult.data as ParsedIntent;

    // 2. Validate entities against the intent-specific schema
    const entitySchema = ENTITY_SCHEMAS[intent.intent];
    if (!entitySchema) {
      errors.push(`No entity schema defined for intent '${intent.intent}'`);
      return { validator: 'schema', passed: false, errors };
    }

    const entityResult = entitySchema.safeParse(intent.entities);
    if (!entityResult.success) {
      return {
        validator: 'schema',
        passed: false,
        errors: entityResult.error.issues.map(
          (i) => `entities.${i.path.join('.')}: ${i.message}`,
        ),
      };
    }

    return {
      validator: 'schema',
      passed: true,
      errors: [],
      detail: { validatedIntent: intent.intent },
    };
  }
}
