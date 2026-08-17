// ─── Validation Service ─────────────────────────────────────────────────────
// Orchestrates all 5 validation sub-layers in order.
// Each sub-layer can reject or downgrade confidence.

import { Injectable } from '@nestjs/common';
import type { ParsedIntent } from '../common/types/intent.types';
import {
  type ValidationResult,
  type ResolvedEntities,
  ValidationDecision,
} from '../common/types/validation.types';
import { SchemaValidator } from './validators/schema.validator';
import { EntityValidator } from './validators/entity.validator';
import { BusinessRuleValidator } from './validators/business-rule.validator';
import { PermissionValidator } from './validators/permission.validator';
import { ConfidenceValidator } from './validators/confidence.validator';

@Injectable()
export class ValidationService {
  constructor(
    private readonly schemaValidator: SchemaValidator,
    private readonly entityValidator: EntityValidator,
    private readonly businessRuleValidator: BusinessRuleValidator,
    private readonly permissionValidator: PermissionValidator,
    private readonly confidenceValidator: ConfidenceValidator,
  ) {}

  /**
   * Run all 5 validation sub-layers in order.
   * Short-circuits on hard failures (schema, entity, permission).
   *
   * Returns the aggregated result + the final decision (approve/reject/confirm).
   */
  async validate(
    parsedIntent: ParsedIntent,
    warehouseId: string,
    userRole: string,
    sttConfidence: number | null,
  ): Promise<{ result: ValidationResult; decision: ValidationDecision }> {
    const result: ValidationResult = {
      passed: false,
      requiresConfirmation: false,
      results: [],
    };

    // ── Sub-layer 1: Schema validation ────────────────────────────
    const schemaResult = this.schemaValidator.validate(parsedIntent);
    result.results.push(schemaResult);
    if (!schemaResult.passed) {
      return { result, decision: ValidationDecision.REJECT };
    }

    // ── Sub-layer 2: Entity resolution ────────────────────────────
    const entityResult = await this.entityValidator.validate(
      parsedIntent,
      warehouseId,
    );
    result.results.push({
      validator: entityResult.validator,
      passed: entityResult.passed,
      errors: entityResult.errors,
      detail: entityResult.detail,
    });
    result.resolvedEntities = entityResult.resolvedEntities;

    if (!entityResult.passed) {
      return { result, decision: ValidationDecision.REJECT };
    }

    // ── Sub-layer 3: Business rules ───────────────────────────────
    const businessResult = await this.businessRuleValidator.validate(
      parsedIntent,
      warehouseId,
      result.resolvedEntities || {},
    );
    result.results.push(businessResult);
    if (!businessResult.passed) {
      return { result, decision: ValidationDecision.REJECT };
    }

    // ── Sub-layer 4: Permission check ─────────────────────────────
    const permissionResult = this.permissionValidator.validate(
      parsedIntent,
      userRole,
    );
    result.results.push(permissionResult);
    if (!permissionResult.passed) {
      return { result, decision: ValidationDecision.REJECT };
    }

    // ── Sub-layer 5: Confidence threshold ─────────────────────────
    const confidenceResult = this.confidenceValidator.validate(
      parsedIntent,
      sttConfidence,
      result.resolvedEntities,
    );
    result.results.push({
      validator: confidenceResult.validator,
      passed: confidenceResult.passed,
      errors: confidenceResult.errors,
      detail: confidenceResult.detail,
    });

    if (confidenceResult.requiresConfirmation) {
      result.requiresConfirmation = true;
      result.confirmationReason = confidenceResult.confirmationReason;
    }

    // ── All checks passed ─────────────────────────────────────────
    result.passed = true;

    const decision = result.requiresConfirmation
      ? ValidationDecision.CONFIRM
      : ValidationDecision.APPROVE;

    return { result, decision };
  }
}
