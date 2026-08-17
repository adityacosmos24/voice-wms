// ─── App Module ─────────────────────────────────────────────────────────────
// Root module wiring all pipeline stages together.
// Each stage = one Nest module, injected into the OrchestratorModule.

import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { SessionModule } from './session/session.module';
import { ValidationModule } from './validation/validation.module';
import { ExecutionModule } from './execution/execution.module';
import { AuditModule } from './audit/audit.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';

@Module({
  imports: [
    DatabaseModule,
    WarehouseModule,
    SessionModule,
    ValidationModule,
    ExecutionModule,
    AuditModule,
    OrchestratorModule,
  ],
})
export class AppModule {}
