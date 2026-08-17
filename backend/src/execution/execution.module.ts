// ─── Execution Module ───────────────────────────────────────────────────────

import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { GoodsReceiptTool } from './tools/goods-receipt.tool';
import { PickTool } from './tools/pick.tool';
import { AdjustInventoryTool } from './tools/adjust-inventory.tool';
import { LogDamageTool } from './tools/log-damage.tool';
import { MoveStockTool } from './tools/move-stock.tool';
import { CycleCountTool } from './tools/cycle-count.tool';

@Module({
  providers: [
    ExecutionService,
    GoodsReceiptTool,
    PickTool,
    AdjustInventoryTool,
    LogDamageTool,
    MoveStockTool,
    CycleCountTool,
  ],
  exports: [ExecutionService],
})
export class ExecutionModule {}
