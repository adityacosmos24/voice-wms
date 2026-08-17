// ─── Log Damage Tool ────────────────────────────────────────────────────────
// Forward: move quantity from good → damaged.
// Inverse: move quantity from damaged → good.

import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from '../../database/schemas/inventory.schema';

export interface LogDamagePayload {
  warehouseId: string;
  skuId: string;
  locationId: string;
  quantity: number;
  reason?: string;
}

export interface LogDamageResult {
  inventoryId: string;
  previousQuantityGood: number;
  previousQuantityDamaged: number;
  newQuantityGood: number;
  newQuantityDamaged: number;
}

@Injectable()
export class LogDamageTool {
  constructor(
    @InjectModel(Inventory.name) private inventoryModel: Model<InventoryDocument>,
  ) {}

  async execute(payload: LogDamagePayload): Promise<{
    result: LogDamageResult;
    inversePayload: LogDamagePayload;
  }> {
    const inventory = await this.inventoryModel.findOne({
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
    }).exec();

    if (!inventory) {
      throw new BadRequestException('Inventory record not found.');
    }

    const previousGood = inventory.quantityGood;
    const previousDamaged = inventory.quantityDamaged;

    // Move qty from good → damaged
    const updated = await this.inventoryModel.findByIdAndUpdate(
      inventory._id,
      {
        $inc: { 
          quantityGood: -payload.quantity,
          quantityDamaged: payload.quantity,
        }
      },
      { new: true }
    ).exec();

    // Inverse: move qty from damaged → good
    const inversePayload: LogDamagePayload = {
      warehouseId: payload.warehouseId,
      skuId: payload.skuId,
      locationId: payload.locationId,
      quantity: payload.quantity,
      reason: `Revert damage report: ${payload.reason ?? 'no reason given'}`,
    };

    return {
      result: {
        inventoryId: updated!._id.toString(),
        previousQuantityGood: previousGood,
        previousQuantityDamaged: previousDamaged,
        newQuantityGood: updated!.quantityGood,
        newQuantityDamaged: updated!.quantityDamaged,
      },
      inversePayload,
    };
  }

  async revert(inversePayload: LogDamagePayload): Promise<void> {
    // Reverse: move qty from damaged → good
    await this.inventoryModel.findOneAndUpdate(
      {
        warehouseId: inversePayload.warehouseId,
        skuId: inversePayload.skuId,
        locationId: inversePayload.locationId,
      },
      {
        $inc: { 
          quantityGood: inversePayload.quantity,
          quantityDamaged: -inversePayload.quantity,
        }
      }
    ).exec();
  }
}
