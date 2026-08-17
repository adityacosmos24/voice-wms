// ─── Audit Module ───────────────────────────────────────────────────────────

import { Module, forwardRef } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RevertService } from './revert.service';
import { AuditGateway } from './audit.gateway';
import { ExecutionModule } from '../execution/execution.module';

// Import the individual tools that RevertService needs
import { GoodsReceiptTool } from '../execution/tools/goods-receipt.tool';
import { PickTool } from '../execution/tools/pick.tool';
import { AdjustInventoryTool } from '../execution/tools/adjust-inventory.tool';
import { LogDamageTool } from '../execution/tools/log-damage.tool';
import { MoveStockTool } from '../execution/tools/move-stock.tool';

@Module({
  imports: [ExecutionModule],
  providers: [
    AuditService,
    RevertService,
    AuditGateway,
    // Provide tools directly for RevertService
    GoodsReceiptTool,
    PickTool,
    AdjustInventoryTool,
    LogDamageTool,
    MoveStockTool,
  ],
  exports: [AuditService, RevertService, AuditGateway],
})
export class AuditModule {}
