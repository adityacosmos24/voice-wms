// ─── Cycle Count Tool ───────────────────────────────────────────────────────
// Forward: set quantity to the counted value.
// Inverse: set quantity back to the previous value.
// Delegates to AdjustInventoryTool since the operation is identical.

import { Injectable } from '@nestjs/common';
import { AdjustInventoryTool, type AdjustInventoryPayload, type AdjustInventoryResult } from './adjust-inventory.tool';

@Injectable()
export class CycleCountTool {
  constructor(private readonly adjustInventoryTool: AdjustInventoryTool) {}

  async execute(payload: AdjustInventoryPayload): Promise<{
    result: AdjustInventoryResult;
    inversePayload: AdjustInventoryPayload;
  }> {
    return this.adjustInventoryTool.execute(payload);
  }

  async revert(inversePayload: AdjustInventoryPayload): Promise<void> {
    return this.adjustInventoryTool.revert(inversePayload);
  }
}
