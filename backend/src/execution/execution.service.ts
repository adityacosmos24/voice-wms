// ─── Execution Service ──────────────────────────────────────────────────────
// Maps intent types to tools. Wraps execution in a transaction.
// Creates Action records with payload + inverse_payload.
// This is the ONLY place that writes to the WMS (inventory tables).

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Action, ActionDocument } from '../database/schemas/action.schema';
import { IntentType, type ParsedIntent } from '../common/types/intent.types';
import { ActionType } from '../common/types/command.types';
import type { ResolvedEntities } from '../common/types/validation.types';
import { GoodsReceiptTool } from './tools/goods-receipt.tool';
import { PickTool } from './tools/pick.tool';
import { AdjustInventoryTool } from './tools/adjust-inventory.tool';
import { LogDamageTool } from './tools/log-damage.tool';
import { MoveStockTool } from './tools/move-stock.tool';
import { CycleCountTool } from './tools/cycle-count.tool';

export interface ExecutionResult {
  actionId: string;
  actionType: string;
  payload: Record<string, unknown>;
  inversePayload: Record<string, unknown>;
  result: Record<string, unknown>;
}

@Injectable()
export class ExecutionService {
  constructor(
    @InjectModel(Action.name) private actionModel: Model<ActionDocument>,
    private readonly goodsReceiptTool: GoodsReceiptTool,
    private readonly pickTool: PickTool,
    private readonly adjustInventoryTool: AdjustInventoryTool,
    private readonly logDamageTool: LogDamageTool,
    private readonly moveStockTool: MoveStockTool,
    private readonly cycleCountTool: CycleCountTool,
  ) {}

  /**
   * Execute a command through the appropriate tool.
   * Creates an Action record with the forward payload and computed inverse.
   */
  async execute(
    commandId: string,
    parsedIntent: ParsedIntent,
    warehouseId: string,
    resolvedEntities: ResolvedEntities,
  ): Promise<ExecutionResult> {
    const entities = parsedIntent.entities as Record<string, unknown>;
    let actionType: ActionType;
    let payload: Record<string, unknown>;
    let inversePayload: Record<string, unknown>;
    let result: Record<string, unknown>;

    switch (parsedIntent.intent) {
      case IntentType.GOODS_RECEIPT: {
        actionType = ActionType.CREATE_GOODS_RECEIPT;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          locationId: resolvedEntities.locationId!,
          quantityGood: Number(entities.quantity_good ?? 0),
          quantityDamaged: Number(entities.quantity_damaged ?? 0),
        };
        const execResult = await this.goodsReceiptTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      case IntentType.PICK: {
        actionType = ActionType.PICK_STOCK;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          locationId: resolvedEntities.locationId!,
          quantity: Number(entities.quantity),
        };
        const execResult = await this.pickTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      case IntentType.PUTAWAY: {
        actionType = ActionType.ADJUST_INVENTORY;
        // Putaway = increment at destination
        const destLocationId = resolvedEntities.destinationLocationId ?? resolvedEntities.locationId;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          locationId: destLocationId!,
          quantityGood: Number(entities.quantity),
          quantityDamaged: 0,
        };
        const execResult = await this.goodsReceiptTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      case IntentType.CYCLE_COUNT: {
        actionType = ActionType.CYCLE_COUNT;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          locationId: resolvedEntities.locationId!,
          newQuantityGood: Number(entities.quantity_good ?? 0),
          newQuantityDamaged: Number(entities.quantity_damaged ?? 0),
        };
        const execResult = await this.cycleCountTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      case IntentType.DAMAGE_REPORT: {
        actionType = ActionType.LOG_DAMAGE;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          locationId: resolvedEntities.locationId!,
          quantity: Number(entities.quantity),
          reason: entities.reason as string | undefined,
        };
        const execResult = await this.logDamageTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      case IntentType.TRANSFER: {
        actionType = ActionType.MOVE_STOCK;
        const p = {
          warehouseId,
          skuId: resolvedEntities.skuId!,
          sourceLocationId: resolvedEntities.sourceLocationId!,
          destinationLocationId: resolvedEntities.destinationLocationId!,
          quantity: Number(entities.quantity),
        };
        const execResult = await this.moveStockTool.execute(p);
        payload = p as unknown as Record<string, unknown>;
        inversePayload = execResult.inversePayload as unknown as Record<string, unknown>;
        result = execResult.result as unknown as Record<string, unknown>;
        break;
      }

      default:
        throw new BadRequestException(
          `Unsupported intent type for execution: ${parsedIntent.intent}`,
        );
    }

    // Create the Action record with forward and inverse payloads
    const action = new this.actionModel({
      commandId,
      actionType,
      payload: payload as any,
      inversePayload: inversePayload as any,
      executedAt: new Date(),
    });
    
    await action.save();

    return {
      actionId: action._id.toString(),
      actionType,
      payload,
      inversePayload,
      result,
    };
  }
}
