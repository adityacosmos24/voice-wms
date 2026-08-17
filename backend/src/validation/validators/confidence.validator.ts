// ─── Confidence Validator ───────────────────────────────────────────────────
// Sub-layer 5: If STT or entity-match confidence is below threshold,
// force the command into human confirmation regardless of other checks.

import { Injectable } from '@nestjs/common';
import type { ParsedIntent } from '../../common/types/intent.types';
import type { SubValidationResult, ResolvedEntities } from '../../common/types/validation.types';
import { DEFAULT_AUTO_APPROVE_CONFIG } from '../../common/types/command.types';

@Injectable()
export class ConfidenceValidator {
  /**
   * Check STT confidence and entity match confidence against thresholds.
   * Below threshold → forces pending_confirmation status.
   */
  validate(
    parsedIntent: ParsedIntent,
    sttConfidence: number | null,
    resolvedEntities: ResolvedEntities | undefined,
  ): SubValidationResult & { requiresConfirmation: boolean; confirmationReason?: string } {
    const config = DEFAULT_AUTO_APPROVE_CONFIG;
    const reasons: string[] = [];
    let requiresConfirmation = false;

    // Check STT confidence
    if (sttConfidence !== null && sttConfidence < config.minSttConfidence) {
      requiresConfirmation = true;
      reasons.push(
        `STT confidence (${(sttConfidence * 100).toFixed(1)}%) is below threshold (${(config.minSttConfidence * 100).toFixed(1)}%).`,
      );
    }

    // Check entity confidence (LLM extraction confidence)
    if (parsedIntent.confidence < config.minEntityConfidence) {
      requiresConfirmation = true;
      reasons.push(
        `Intent extraction confidence (${(parsedIntent.confidence * 100).toFixed(1)}%) is below threshold (${(config.minEntityConfidence * 100).toFixed(1)}%).`,
      );
    }

    // Check resolved entity match confidence
    if (resolvedEntities) {
      if (
        resolvedEntities.skuMatchConfidence !== undefined &&
        resolvedEntities.skuMatchConfidence < config.minEntityConfidence
      ) {
        requiresConfirmation = true;
        reasons.push(
          `SKU match confidence (${(resolvedEntities.skuMatchConfidence * 100).toFixed(1)}%) is below threshold.`,
        );
      }
      if (
        resolvedEntities.locationMatchConfidence !== undefined &&
        resolvedEntities.locationMatchConfidence < config.minEntityConfidence
      ) {
        requiresConfirmation = true;
        reasons.push(
          `Location match confidence (${(resolvedEntities.locationMatchConfidence * 100).toFixed(1)}%) is below threshold.`,
        );
      }
    }

    // Check quantity thresholds — large changes always require confirmation
    const entities = parsedIntent.entities as Record<string, unknown>;
    const quantities = [
      Number(entities.quantity ?? 0),
      Number(entities.quantity_good ?? 0),
      Number(entities.quantity_damaged ?? 0),
    ].filter((q) => q > 0);

    const maxQuantity = Math.max(0, ...quantities);
    if (maxQuantity > config.maxAutoApproveQuantity) {
      requiresConfirmation = true;
      reasons.push(
        `Quantity (${maxQuantity}) exceeds auto-approve threshold (${config.maxAutoApproveQuantity}).`,
      );
    }

    // Check if this intent always requires confirmation
    if (config.alwaysConfirmIntents.includes(parsedIntent.intent)) {
      requiresConfirmation = true;
      reasons.push(
        `Intent '${parsedIntent.intent}' always requires confirmation.`,
      );
    }

    // Check for ambiguities from the LLM
    if (parsedIntent.ambiguities && parsedIntent.ambiguities.length > 0) {
      requiresConfirmation = true;
      reasons.push(
        `Ambiguities detected: ${parsedIntent.ambiguities.join('; ')}.`,
      );
    }

    return {
      validator: 'confidence',
      passed: true, // Confidence doesn't "fail" — it forces confirmation
      errors: [],
      requiresConfirmation,
      confirmationReason: reasons.length > 0 ? reasons.join(' ') : undefined,
      detail: {
        sttConfidence,
        intentConfidence: parsedIntent.confidence,
        requiresConfirmation,
        reasons,
      },
    };
  }
}
