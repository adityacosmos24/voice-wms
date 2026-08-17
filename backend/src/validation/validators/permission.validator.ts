// ─── Permission Validator ───────────────────────────────────────────────────
// Sub-layer 4: Does this user's role allow this action?
// A picker shouldn't be able to trigger a financial write-off or goods receipt.

import { Injectable } from '@nestjs/common';
import type { ParsedIntent } from '../../common/types/intent.types';
import {
  ROLE_PERMISSIONS,
  type SubValidationResult,
} from '../../common/types/validation.types';

@Injectable()
export class PermissionValidator {
  /**
   * Check whether the user's role permits the given intent.
   */
  validate(parsedIntent: ParsedIntent, userRole: string): SubValidationResult {
    const allowedIntents = ROLE_PERMISSIONS[userRole];

    if (!allowedIntents) {
      return {
        validator: 'permission',
        passed: false,
        errors: [`Unknown role '${userRole}' — no permissions defined.`],
      };
    }

    if (!allowedIntents.includes(parsedIntent.intent)) {
      return {
        validator: 'permission',
        passed: false,
        errors: [
          `Role '${userRole}' is not authorized to perform '${parsedIntent.intent}'. ` +
          `Allowed actions: [${allowedIntents.join(', ')}].`,
        ],
        detail: { role: userRole, intent: parsedIntent.intent, allowedIntents },
      };
    }

    return {
      validator: 'permission',
      passed: true,
      errors: [],
      detail: { role: userRole, intent: parsedIntent.intent },
    };
  }
}
