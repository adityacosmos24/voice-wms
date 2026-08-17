// ─── Validation Module ──────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { SchemaValidator } from './validators/schema.validator';
import { EntityValidator } from './validators/entity.validator';
import { BusinessRuleValidator } from './validators/business-rule.validator';
import { PermissionValidator } from './validators/permission.validator';
import { ConfidenceValidator } from './validators/confidence.validator';

@Module({
  providers: [
    ValidationService,
    SchemaValidator,
    EntityValidator,
    BusinessRuleValidator,
    PermissionValidator,
    ConfidenceValidator,
  ],
  exports: [ValidationService],
})
export class ValidationModule {}
