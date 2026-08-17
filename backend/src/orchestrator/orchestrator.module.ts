import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { CommandStateMachine } from './state-machine';
import { ValidationModule } from '../validation/validation.module';
import { ExecutionModule } from '../execution/execution.module';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { VoiceModule } from '../voice/voice.module';
import { IntentModule } from '../intent/intent.module';

@Module({
  imports: [
    ValidationModule,
    ExecutionModule,
    AuditModule,
    SessionModule,
    WarehouseModule,
    VoiceModule,
    IntentModule,
  ],
  providers: [OrchestratorService, CommandStateMachine],
  controllers: [OrchestratorController],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
